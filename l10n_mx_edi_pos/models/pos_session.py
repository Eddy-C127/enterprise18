# -*- coding: utf-8 -*-
from odoo import models


class PosSession(models.Model):
    _inherit = 'pos.session'

    def _load_data_params(self, config_id):
        params = super()._load_data_params(config_id)

        if self.company_id.country_code == 'MX':
            params['res.partner']['fields'] += ['l10n_mx_edi_fiscal_regime', 'l10n_mx_edi_no_tax_breakdown', 'country_code']

        return params

    def load_data(self, models_to_load, only_data=False):
        response = super().load_data(models_to_load, only_data)

        l10n_mx_edi_fiscal_regime = self.env['ir.model.fields']._get('res.partner', 'l10n_mx_edi_fiscal_regime')
        l10n_mx_edi_usage = self.env['ir.model.fields']._get('account.move', 'l10n_mx_edi_usage')

        if not only_data:
            response['custom']['l10n_mx_edi_fiscal_regime'] = [{'value': s.value, 'name': s.name} for s in l10n_mx_edi_fiscal_regime.selection_ids]
            response['custom']['l10n_mx_edi_usage'] = [{'value': s.value, 'name': s.name} for s in l10n_mx_edi_usage.selection_ids]
            response['custom']['l10n_mx_country_id'] = self.env['res.country'].search([('code', '=', 'MX')], limit=1).id

        return response
