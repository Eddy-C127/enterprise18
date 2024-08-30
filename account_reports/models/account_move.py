# -*- coding: utf-8 -*-
import ast

from odoo.addons.account.models.exceptions import TaxClosingNonPostedDependingMovesError
from odoo import api, models, fields, _
from odoo.exceptions import UserError
from odoo.tools.misc import format_date
from odoo.tools import date_utils
from odoo.addons.web.controllers.utils import clean_action

from dateutil.relativedelta import relativedelta
from markupsafe import Markup


class AccountMove(models.Model):
    _inherit = "account.move"

    # used for VAT closing, containing the end date of the period this entry closes
    tax_closing_end_date = fields.Date()
    tax_report_control_error = fields.Boolean() # DEPRECATED; will be removed in master
    # technical field used to know whether to show the tax closing alert or not
    tax_closing_alert = fields.Boolean(compute='_compute_tax_closing_alert')

    def _post(self, soft=True):
        # Overridden to create carryover external values and join the pdf of the report when posting the tax closing
        for move in self.filtered(lambda m: m.tax_closing_end_date):
            report, options = move._get_report_options_from_tax_closing_entry()
            move._close_tax_period(report, options)

        return super()._post(soft)

    def action_post(self):
        # In the case of a TaxClosingNonPostedDependingMovesError, which can occur when dealing with branches or tax
        # units during the closing process, the parent company may have non-posted closing entries from other companies.
        # If this exception occurs, we will return an action client that will display a component indicating that there
        # are non-posted dependent moves, along with a link to those moves.
        # Also, we are not using a RedirectWarning because it will force a rollback on the closing move created for
        # depending companies.
        try:
            res = super().action_post()
        except TaxClosingNonPostedDependingMovesError as exception:
            return {
                "type": "ir.actions.client",
                "tag": "account_reports.redirect_action",
                "target": "new",
                "name": "Depending Action",
                "params": {
                    "depending_action": exception.args[0],
                },
                'context': {
                    'dialog_size': 'medium',
                }
            }
        return res

    def button_draft(self):
        # Overridden in order to delete the carryover values when resetting the tax closing to draft
        super().button_draft()
        for closing_move in self.filtered(lambda m: m.tax_closing_end_date):
            report, options = closing_move._get_report_options_from_tax_closing_entry()
            closing_months_delay = closing_move.company_id._get_tax_periodicity_months_delay()

            carryover_values = self.env['account.report.external.value'].search([
                ('carryover_origin_report_line_id', 'in', report.line_ids.ids),
                ('date', '=', options['date']['date_to']),
            ])

            carryover_impacted_period_end = fields.Date.from_string(options['date']['date_to']) + relativedelta(months=closing_months_delay)
            tax_lock_date = closing_move.company_id.tax_lock_date
            if carryover_values and tax_lock_date and tax_lock_date >= carryover_impacted_period_end:
                raise UserError(_("You cannot reset this closing entry to draft, as it would delete carryover values impacting the tax report of a "
                                  "locked period. To do this, you first need to modify you tax return lock date."))

            if self._has_subsequent_posted_closing_moves():
                raise UserError(_("You cannot reset this closing entry to draft, as another closing entry has been posted at a later date."))

            carryover_values.unlink()

    def _has_subsequent_posted_closing_moves(self):
        self.ensure_one()
        closing_domains = [
            ('company_id', '=', self.company_id.id),
            ('tax_closing_end_date', '!=', False),
            ('state', '=', 'posted'),
            ('date', '>', self.date),
            ('fiscal_position_id', '=', self.fiscal_position_id.id)
        ]
        return bool(self.env['account.move'].search_count(closing_domains, limit=1))

    def _get_tax_to_pay_on_closing(self):
        self.ensure_one()
        tax_payable_accounts = self.env['account.tax.group'].search([
            ('company_id', '=', self.company_id.id),
        ]).tax_payable_account_id
        payable_lines = self.line_ids.filtered(lambda line: line.account_id in tax_payable_accounts)
        return self.currency_id.round(-sum(payable_lines.mapped('balance')))

    def _action_tax_to_pay_wizard(self):
        # hook for l10n tax payment wizard
        return self.action_open_tax_report()

    def action_open_tax_report(self):
        action = self.env["ir.actions.actions"]._for_xml_id("account_reports.action_account_report_gt")
        if not self.tax_closing_end_date:
            raise UserError(_("You can't open a tax report from a move without a VAT closing date."))
        options = self._get_report_options_from_tax_closing_entry()[1]
        # Pass options in context and set ignore_session: true to prevent using session options
        action.update({'params': {'options': options, 'ignore_session': True}})
        return action

    def _close_tax_period(self, report, options):
        """ Closes tax closing entries. The tax closing activities on them will be marked done, and the next tax closing entry
        will be generated or updated (if already existing). Also, a pdf of the tax report at the time of closing
        will be posted in the chatter of each move.

        The tax lock date of each  move's company will be set to the move's date in case no other draft tax closing
        move exists for that company (whatever their foreign VAT fiscal position) before or at that date, meaning that
        all the tax closings have been performed so far.
        """
        if not self.env.user.has_group('account.group_account_manager'):
            raise UserError(_('Only Billing Administrators are allowed to change lock dates!'))

        tax_closing_activity_type = self.env.ref('account_reports.tax_closing_activity_type')

        for move in self:
            # Change lock date to end date of the period, if all other tax closing moves before this one have been treated
            open_previous_closing = self.env['account.move'].search([
                ('activity_ids.activity_type_id', '=', tax_closing_activity_type.id),
                ('company_id', '=', move.company_id.id),
                ('date', '<=', move.date),
                ('state', '=', 'draft'),
                ('id', '!=', move.id),
            ], limit=1)

            report, options = move._get_report_options_from_tax_closing_entry()

            if not open_previous_closing and (not move.company_id.tax_lock_date or move.tax_closing_end_date > move.company_id.tax_lock_date):
                move.company_id.sudo().tax_lock_date = move.tax_closing_end_date
                self.env['account.report']._generate_default_external_values(options['date']['date_from'], options['date']['date_to'], True)

            sender_company = report._get_sender_company_for_export(options)
            company_ids = report.get_report_company_ids(options)
            if sender_company == move.company_id:
                # In branch/tax unit setups, first post all the unposted moves of the other companies when posting the main company.
                # The action param will be the value of the from_post argument
                tax_closing_action = report.dispatch_report_action(options, 'action_periodic_vat_entries', action_param=True, on_sections_source=report.use_sections)
                depending_closings = self.env['account.move'].with_context(allowed_company_ids=company_ids).search([
                    *(tax_closing_action.get('domain') or [('id', '=', tax_closing_action['res_id'])]),
                    ('id', '!=', move.id),
                ])
                depending_closings_to_post = depending_closings.filtered(lambda x: x.state == 'draft')
                if depending_closings_to_post:
                    depending_action = self.env["ir.actions.actions"]._for_xml_id("account.action_move_journal_line")
                    depending_action = clean_action(depending_action, env=self.env)

                    if len(depending_closings_to_post) == 1:
                        depending_action['views'] = [(self.env.ref('account.view_move_form').id, 'form')]
                        depending_action['res_id'] = depending_closings_to_post.id
                    else:
                        depending_action['domain'] = [('id', 'in', depending_closings_to_post.ids)]
                        depending_action['context'] = dict(ast.literal_eval(depending_action['context']))
                        depending_action['context'].pop('search_default_posted', None)

                    # In case of dependent moves, we will raise an error that will be caught in the action_post method.
                    # When the exception is caught, a component will inform the user that there are some dependent moves
                    # to be posted and provide a link to these moves.
                    raise TaxClosingNonPostedDependingMovesError(depending_action)

                # Generate the carryover values.
                report.with_context(allowed_company_ids=company_ids)._generate_carryover_external_values(options)

                # Post the message with the attachments (PDF of the report, and possibly an additional export file)
                attachments = move._get_vat_report_attachments(report, options)
                subject = _(
                    "Vat closing from %(date_from)s to %(date_to)s",
                    date_from=format_date(self.env, options['date']['date_from']),
                    date_to=format_date(self.env, options['date']['date_to']),
                )
                move.with_context(no_new_invoice=True).message_post(body=move.ref, subject=subject, attachments=attachments)

                # Log a note on depending closings, redirecting to the main one
                for closing_move in depending_closings:
                    closing_move.message_post(
                        body=Markup(_("The attachments of the tax report can be found on the <a href='#' data-oe-model='account.move' data-oe-id='%s'>closing entry</a> of the representative company.", move.id)),
                    )

            # End activity
            activity = move.activity_ids.filtered(lambda m: m.activity_type_id.id == tax_closing_activity_type.id)
            if activity:
                activity.action_done()

            # Create the recurring entry (new draft move and new activity)
            if move.fiscal_position_id.foreign_vat:
                next_closing_params = {'fiscal_positions': move.fiscal_position_id}
            else:
                next_closing_params = {'include_domestic': True}
            move.company_id._get_and_update_tax_closing_moves(move.tax_closing_end_date + relativedelta(days=1), **next_closing_params)

        self._close_tax_period_pay_activity()

    def _close_tax_period_pay_activity(self):
        MailActivity = self.env['mail.activity'].with_context(mail_activity_quick_update=True)
        activity_type = self.env.ref('account_reports.mail_activity_type_tax_report_to_pay', raise_if_not_found=False)
        if not activity_type:
            return
        act_user = activity_type.default_user_id
        if act_user and not (self.company_id in act_user.company_ids and self.env.ref(
                'account.group_account_manager') in act_user.groups_id):
            act_user = self.env['res.users']

        move_ids_with_activity = self.env['mail.activity'].search([
            ('res_model', '=', self._name),
            ('res_id', 'in', self.ids),
            ('activity_type_id', '=', activity_type.id),
        ]).mapped('res_id')

        for move in self.filtered(lambda m: m.id not in move_ids_with_activity and m._get_tax_to_pay_on_closing() > 0):
            period_start, period_end = move.company_id._get_tax_closing_period_boundaries(move.date)
            period_desc = move.company_id._get_tax_closing_move_description(move.company_id.account_tax_periodicity, period_start, period_end, move.fiscal_position_id)
            MailActivity.create({
                'res_id': move.id,
                'res_model_id': self.env.ref('account.model_account_move').id,
                'activity_type_id': activity_type.id,
                'summary': _("Pay tax: %s", period_desc),
                'note': activity_type.default_note,
                'date_deadline': fields.Date.context_today(move),
                'automated': True,
                'user_id': act_user.id or self.env.user.id,
                'chaining_type': 'suggest',  # the next activity should only be created by closing the next tax entry
            })

    def refresh_tax_entry(self):
        for move in self.filtered(lambda m: m.tax_closing_end_date and m.state == 'draft'):
            report, options = move._get_report_options_from_tax_closing_entry()
            self.env['account.generic.tax.report.handler']._generate_tax_closing_entries(report, options, closing_moves=move)

    def _get_report_options_from_tax_closing_entry(self):
        self.ensure_one()
        date_to = self.tax_closing_end_date
        # Take the periodicity of tax report from the company and compute the starting period date.
        delay = self.company_id._get_tax_periodicity_months_delay() - 1
        date_from = date_utils.start_of(date_to + relativedelta(months=-delay), 'month')

        # In case the company submits its report in different regions, a closing entry
        # is made for each fiscal position defining a foreign VAT.
        # We hence need to make sure to select a tax report in the right country when opening
        # the report (in case there are many, we pick the first one available; it doesn't impact the closing)
        if self.fiscal_position_id.foreign_vat:
            fpos_option = self.fiscal_position_id.id
            report_country = self.fiscal_position_id.country_id
        else:
            fpos_option = 'domestic'
            report_country = self.company_id.account_fiscal_country_id

        generic_tax_report = self.env.ref('account.generic_tax_report')
        tax_report = self.env['account.report'].search([
            ('availability_condition', '=', 'country'),
            ('country_id', '=', report_country.id),
            ('root_report_id', '=', generic_tax_report.id),
        ], limit=1)

        if not tax_report:
            tax_report = generic_tax_report

        options = {
            'date': {
                'date_from': fields.Date.to_string(date_from),
                'date_to': fields.Date.to_string(date_to),
                'filter': 'custom',
                'mode': 'range',
            },
            'fiscal_position': fpos_option,
            'tax_unit': 'company_only',
        }

        if tax_report.filter_multi_company == 'tax_units':
            # Enforce multicompany if the closing is done for a tax unit
            candidate_tax_unit = self.company_id.account_tax_unit_ids.filtered(lambda x: x.country_id == report_country)
            if candidate_tax_unit:
                options['tax_unit'] = candidate_tax_unit.id
                company_ids = candidate_tax_unit.company_ids.ids
            else:
                same_vat_branches = self.env.company._get_branches_with_same_vat()
                # Consider the one with the least number of parents (highest in hierarchy) as the active company, coming first
                company_ids = same_vat_branches.sorted(lambda x: len(x.parent_ids)).ids
        else:
            company_ids = self.env.company.ids

        report_options = tax_report.with_context(allowed_company_ids=company_ids).get_options(previous_options=options)

        return tax_report, report_options

    def _get_vat_report_attachments(self, report, options):
        # Fetch pdf
        pdf_data = report.export_to_pdf(options)
        return [(pdf_data['file_name'], pdf_data['file_content'])]

    def _compute_tax_closing_alert(self):
        for move in self:
            move.tax_closing_alert = (
                move.state == 'posted'
                and move.tax_closing_end_date
                and move.company_id.tax_lock_date
                and move.company_id.tax_lock_date < move.tax_closing_end_date
            )
