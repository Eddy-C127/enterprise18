# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, release, _
from odoo.exceptions import UserError

from datetime import datetime
from collections import defaultdict
from odoo.tools.float_utils import float_round
from odoo.tools import SQL

import calendar

class IntrastatReportCustomHandler(models.AbstractModel):
    _inherit = 'account.intrastat.report.handler'

    def _custom_options_initializer(self, report, options, previous_options):
        super()._custom_options_initializer(report, options, previous_options)

        if self.env.company.account_fiscal_country_id.code != 'FR':
            return

        options.setdefault('buttons', []).append({
            'name': _('XML (DEBWEB2)'),
            'sequence': 30,
            'action': 'l10n_fr_intrastat_open_export_wizard',
            'file_export_type': 'XML',
        })

    def l10n_fr_intrastat_open_export_wizard(self, options):
        if self.env.company.currency_id.display_name != 'EUR':
            raise UserError(_('The currency of the company must be EUR to generate the XML export'))

        return {
            'name': _('XML (DEBWEB2)'),
            'view_mode': 'form',
            'views': [[False, 'form']],
            'res_model': 'l10n_fr_intrastat.export.wizard',
            'type': 'ir.actions.act_window',
            'res_id': False,
            'target': 'new',
            'context': dict(self._context, l10n_fr_intrastat_export_options=options),
        }

    @api.model
    def _retrieve_fr_intrastat_wizard(self, options):
        wizard_id = options.get('l10n_fr_intrastat_wizard_id')
        if not wizard_id:
            return False
        return self.env['l10n_fr_intrastat.export.wizard'].browse(wizard_id)

    @api.model
    def _build_query(self, options, column_group_key=None, expanded_line_options=None):
        if self.env.company.country_id.code != 'FR':
            return super()._build_query(options, column_group_key, expanded_line_options)

        fr_intrastat_wizard = self._retrieve_fr_intrastat_wizard(options)
        if not fr_intrastat_wizard:
            return super()._build_query(options, column_group_key, expanded_line_options)

        export_type = fr_intrastat_wizard.export_type
        emebi_flow = fr_intrastat_wizard.emebi_flow

        query = super()._build_query(options, column_group_key, expanded_line_options)

        if export_type == 'statistical_survey' and emebi_flow == 'arrivals':
            # Only system 11 are needed (arrivals)
            query['where'] = SQL("%s AND account_move.move_type IN ('in_invoice', 'out_refund')", query['where'])

        if (
            (export_type == 'statistical_survey' and emebi_flow == 'dispatches')
            or (export_type == 'vat_summary_statement')
            or (export_type == 'statistical_survey_and_vat_summary_statement' and emebi_flow == 'dispatches')
        ):
            # Only system 21 are needed (displatches)
            query['where'] = SQL("%s AND account_move.move_type NOT IN ('in_invoice', 'out_refund')", query['where'])

        return query

    @api.model
    def l10n_fr_intrastat_export_to_xml(self, options):
        """Generate XML content of the French Intrastat declaration"""

        report = self.env['account.report'].browse(options['report_id'])
        fr_intrastat_wizard = self._retrieve_fr_intrastat_wizard(options)

        # Determine whether items with regime 21 should be detailed or not
        is_regime_21_short = (
            fr_intrastat_wizard.export_type == 'vat_summary_statement'
            or (
                fr_intrastat_wizard.export_type == 'statistical_survey_and_vat_summary_statement'
                and fr_intrastat_wizard.emebi_flow == 'arrivals'
            )
        )

        values = {'errors': []}
        missing_required_values = {
            'transaction_code': [],
            'region_code': [],
            'transport_code': [],
            'intrastat_product_origin_country_code': [],
            'commodity_code': set(),
            'partner_vat': set()
        }

        self.env.flush_all()
        query, params = self._prepare_query(options)
        self._cr.execute(query, params)
        query_res = self._cr.dictfetchall()
        query_res = self._fill_missing_values(query_res)

        # items are divided by regime (system)
        items = defaultdict(list)
        for item in query_res:
            # Should never be True, but we make sure because so far we only handle regime 11 and 21
            if item['system'] not in ('11', '21'):
                continue

            is_detailed_item_required = not is_regime_21_short or item['system'] != '21'
            if is_detailed_item_required:
                self._check_missing_required_values(item, missing_required_values)
                self._pre_adjust_item_values(item)

            items[item['system']].append(item)

        if not any(items['11'] + items['21']):
            raise UserError(_("There is no line to export with the selected options"))

        self._fill_value_errors(options, values, missing_required_values)
        self._group_items(items, is_regime_21_short)
        self._post_adjust_items_values(items)
        self._generate_envelope_data(options, self.env.company, values)
        self._generate_declarations(items, self.env.company, fr_intrastat_wizard.export_type, values)

        file_data = report._generate_file_data_with_error_check(
            options,
            self.env['ir.qweb']._render,
            {'values': values, 'template': 'l10n_fr_intrastat.intrastat_report_export_xml', 'file_type': 'xml'},
            values['errors'],
        )
        return file_data

    @api.model
    def _get_company_identifier(self, company_id, values):
        """ Return: FR (ISO code of the country) + VAT number key (2 alphanumeric) + SIREN number (9 digits) + SIRET complement (5 digits) """
        company_vat = company_id.vat or ''
        company_siret = company_id.siret[9:14] if company_id.siret and len(company_id.siret) >= 14 else ''
        if not company_vat or not company_siret:
            values['errors'].append({
                'message': _("The VAT or SIRET code is not properly set on company '%s'.") % company_id.name,
                'action_text': _("Configure company"),
                'action_name': 'action_open_partner_company',
                'action_params': {'company_id': company_id.partner_id.id},
                'critical': False,
            })
        return f'{company_vat}{company_siret}'

    @api.model
    def _check_missing_required_values(self, item, missing_required_values):
        if not item['transaction_code']:
            missing_required_values['transaction_code'].append(item['id'])

        if not item['commodity_code']:
            missing_required_values['commodity_code'].add(item['product_id'])

        if not item['intrastat_product_origin_country_code'] or item['intrastat_product_origin_country_code'] == 'QU':
            missing_required_values['intrastat_product_origin_country_code'].append(item['id'])

        if not item['region_code']:
            missing_required_values['region_code'].append(item['id'])

        if not item['transport_code']:
            missing_required_values['transport_code'].append(item['invoice_id'])

        # default intrastat use QV OR QN for missing partner VAT code but France does not accept this notation
        if item['system'] == '21' and (not item['partner_vat'] or item['partner_vat'].startswith('QV') or item['partner_vat'].startswith('QN')):
            missing_required_values['partner_vat'].add(item['partner_id'])

    @api.model
    def _pre_adjust_item_values(self, item):
        """Pre-adjusts the values of the exported items to ensure compliance with expected formats."""
        item['nature_of_transaction_A_code'] = str(item['transaction_code'])[0]
        item['nature_of_transaction_B_code'] = str(item['transaction_code'])[1]
        item['additional_goods_code'] = str(item['commodity_code'][8]) if len(str(item['commodity_code'])) > 8 else None
        item['commodity_code'] = str(item['commodity_code'])[:8]
        item['SU_code'] = item['supplementary_units_code']

    @api.model
    def _fill_value_errors(self, options, values, missing_required_values):
        """Adds error messages to display to the user when certain required values are missing."""
        if missing_required_values['transaction_code']:
            values['errors'].append({
                'message': _("Missing transaction code for journal items"),
                'action_text': _("Set transaction code"),
                'action_name': 'action_invalid_code_moves',
                'action_params': {'options': options, 'params': {'ids': missing_required_values['transaction_code']}},
                'critical': False,
            })

        if missing_required_values['commodity_code']:
            values['errors'].append({
                'message': _("Missing commodity code for some products"),
                'action_text': _("Set commodity code"),
                'action_name': 'action_invalid_code_products',
                'action_params': {'options': options, 'params': {'ids': list(missing_required_values['commodity_code'])}},
                'critical': False,
            })

        if missing_required_values['intrastat_product_origin_country_code']:
            values['errors'].append({
                'message': _("Missing country of origin for journal items, 'QU' will be set as default value"),
                'action_text': _("Set country of origin"),
                'action_name': 'action_missing_intrastat_product_origin_country_code',
                'action_params': {'move_line_ids': missing_required_values['intrastat_product_origin_country_code']},
                'critical': False,
            })

        if missing_required_values['region_code']:
            values['errors'].append({
                'message': _("Missing department code for journal entries"),
                'action_text': _("Set department code"),
                'action_name': 'action_open_settings',
                'action_params': {'company_id': self.env.company.id},
                'critical': False,
            })

        if missing_required_values['transport_code']:
            values['errors'].append({
                'message': _("Missing transport code for journal entries"),
                'action_text': _("Set transport code"),
                'action_name': 'action_invalid_transport_mode_moves',
                'action_params': {'move_ids': missing_required_values['transport_code']},
                'critical': False,
            })

        if missing_required_values['partner_vat']:
            values['errors'].append({
                'message': _("Missing partner VAT"),
                'action_text': 'Set partner vat',
                'action_name': 'action_open_partners',
                'action_params': {'partner_ids': list(missing_required_values['partner_vat'])},
                'critical': False,
            })

    @api.model
    def _group_items(self, items, is_regime_21_short):
        """
        Groups the items if they share some similar values
        - If export_type is statistical_survey and the flow is arrivals, group lines if they share the same values for the following properties:
        nomenclature, regime, transport mode, country of origin, country of provenance, department, nature of transaction
        - If export_type is statistical_survey and the flow is dispatch, group lines if they share the same values for the following properties:
        nomenclature, regime, transport mode, country of origin, country of provenance, department, nature of transaction, customer vat
        - If export_type is vat_summary_statement:
        regime, customer vat

        note:
            - nomenclature includes the 3 following properties: commodity_code, SU_code, additional_goods_code
            - nature of transaction is divided into 2: nature_of_transaction_A_code, nature_of_transaction_B_code
        """

        for regime in items:
            if regime == '11':
                grouping_key = ['commodity_code', 'SU_code', 'additional_goods_code', 'system', 'transport_code',
                                'intrastat_product_origin_country_code', 'country_code', 'region_code',
                                'nature_of_transaction_A_code', 'nature_of_transaction_B_code']
            elif regime == '21' and not is_regime_21_short:
                grouping_key = ['commodity_code', 'SU_code', 'additional_goods_code', 'system', 'transport_code',
                                'intrastat_product_origin_country_code', 'country_code', 'region_code',
                                'nature_of_transaction_A_code', 'nature_of_transaction_B_code', 'partner_vat']
            else:
                grouping_key = ['system', 'partner_vat']

            is_weight_required = not(regime == '21' and is_regime_21_short)

            # Determine values fields
            if is_weight_required:
                grouped_items = defaultdict(lambda: {'value': 0, 'weight': 0})
            else:
                grouped_items = defaultdict(lambda: {'value': 0})

            # Group items and sum their values and weights
            for item in items[regime]:
                item_group_key = tuple(item[prop] for prop in grouping_key)
                grouped_items[item_group_key]['value'] += item['value']
                if is_weight_required:
                    grouped_items[item_group_key]['weight'] += item['weight']

            # Convert the grouped_items dictionary back to a list of dictionaries
            items[regime] = [dict(zip(grouping_key, grouped_item_key)) | grouped_item_values
                             for grouped_item_key, grouped_item_values in grouped_items.items()]

    @api.model
    def _post_adjust_items_values(self, items):
        """Complete values with what is expected once they are grouped. Rounding is made once items grouped for correctness"""
        def round_half_up(value):
            return int(float_round(value, precision_digits=0, rounding_method='HALF-UP'))

        for regime_items in items.values():
            for item in regime_items:
                # The weight must be rounded off in kilograms.
                # Weights below 1 kilogram should be rounded off above.
                if item.get('weight'):
                    item['weight'] = round_half_up(item['weight']) or 1

                # Same logic as weight for supplementary units
                if item.get('supplementary_units'):
                    item['supplementary_units'] = round_half_up(item['supplementary_units']) or 1

                item['value'] = round_half_up(item['value'])
                if item['value'] <= 0:
                    regime_items.remove(item)

    @api.model
    def _generate_envelope_data(self, options, company, values):
        """Generates the data encoded in the envelope tag"""
        envelope_id = company.l10n_fr_intrastat_envelope_id
        if not envelope_id:
            values['errors'].append({
                'message': _("Please set the approval number issued by your local collection center in the Accounting settings"),
                'action_text': _("Configure settings"),
                'action_name': 'action_open_settings',
                'action_params': {'company_id': company.id},
                'critical': False,
            })

        # Software used, 14 character maximum allowed (must include the version too)
        software_used = 'Odoo ' + release.major_version

        date_from = fields.Date.to_date(options['date']['date_from'])
        date_to = fields.Date.to_date(options['date']['date_to'])
        expected_diff_days = calendar.monthrange(date_to.year, date_to.month)[1] - 1
        if date_from.day != 1 or (date_to - date_from).days != expected_diff_days:
            raise UserError(_('Wrong date range selected. The intrastat declaration export has to be done monthly.'))

        # Use the data of the accounting firm (fiduciary) if available, otherwise use the company data
        registrant = company.account_representative_id or company
        party_name = company.account_representative_id.name or company.name
        party_type = 'TDP' if company.account_representative_id else 'PSI'
        party_role = 'PSI'
        party_id = self._get_company_identifier(registrant, values)

        values.update({
            'envelope_id': envelope_id,
            'software_used': software_used,
            'date_from': date_from,
            'date_to': date_to,
            'party_id': party_id,
            'party_name': party_name,
            'envelope_date': datetime.now().strftime('%Y-%m-%d'),
            'envelope_time': datetime.now().strftime('%H:%M:%S'),
            'party_type': party_type,
            'party_role': party_role,
        })

    @api.model
    def _generate_declarations(self, items, company, export_type, values):
        common_declarations_map = self._get_common_declarations_data(company, export_type, values)
        declarations = []

        # Arrival flow declaration
        if items['11']:
            declarations.append({
                **common_declarations_map,
                'flow_code': 'A',
                'items': items['11'],
            })

        # Dispatch flow declaration
        if items['21']:
            declarations.append({
                **common_declarations_map,
                'flow_code': 'D',
                'items': items['21'],
            })

        values['declarations'] = declarations

    @api.model
    def _get_common_declarations_data(self, company, export_type, values):
        """Returns a declaration dictionary including common information for arrivals and dispatches"""
        psi_id = self._get_company_identifier(company, values)

        declaration_type_codes = {
            'statistical_survey': 1,
            'vat_summary_statement': 4,
            'statistical_survey_and_vat_summary_statement': 5,
        }

        return {
            'reference_period': values['date_from'].strftime('%Y-%m'),
            'PSI_id': psi_id,
            'function_code': 'O',  # only possible value according to French documentation
            'currency_code': 'EUR',  # only EUR is accepted for French XML documents
            'declaration_type_code': declaration_type_codes[export_type],
        }
