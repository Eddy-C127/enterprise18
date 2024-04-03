# -*- coding: utf-8 -*-
from odoo import models


class PosSession(models.Model):
    _inherit = 'pos.session'

    def _load_pos_data(self, data):
        data = super()._load_pos_data(data)
        if self.env.company.country_id.code == 'CL':
            data['data'][0]['_sii_taxpayer_types'] = self.env['res.partner'].get_sii_taxpayer_types()
            data['data'][0]['_consumidor_final_anonimo_id'] = self.env.ref('l10n_cl.par_cfa').id
        return data
