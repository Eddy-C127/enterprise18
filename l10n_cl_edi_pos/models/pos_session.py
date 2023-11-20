# -*- coding: utf-8 -*-
from odoo import models


class PosSession(models.Model):
    _inherit = 'pos.session'

    def _load_data_params(self, config_id):
        params = super()._load_data_params(config_id)

        params['pos.payment.method']['fields'].append('is_card_payment')

        if self.company_id.country_code == 'CL':
            params['res.partner']['fields'] += ['l10n_latam_identification_type_id', 'l10n_cl_sii_taxpayer_type', 'l10n_cl_activity_description', 'l10n_cl_dte_email']
            params['res.company']['fields'] += ['l10n_cl_dte_resolution_number', 'l10n_cl_dte_resolution_date']
            params['l10n_latam.identification.type'] = {
                'domain': [('active', '=', True)],
                'fields': ['name'],
            }

        return params

    def load_data(self, models_to_load, only_data=False):
        response = super().load_data(models_to_load, only_data)

        if not only_data:
            response['custom']['sii_taxpayer_types'] = self.env['res.partner'].get_sii_taxpayer_types()
            response['custom']['consumidor_final_anonimo_id'] = self.env.ref('l10n_cl.par_cfa').id

        return response
