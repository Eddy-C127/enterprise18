# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, api


class PosSession(models.Model):
    _inherit = 'pos.session'

    def get_onboarding_data(self):
        result = super().get_onboarding_data()

        response = self.load_data(['pos_preparation_display.display'], True)
        result.update(response['data'])

        return result

    @api.model
    def _load_pos_data_models(self, config_id):
        data = super()._load_pos_data_models(config_id)
        data += ['pos_preparation_display.display']
        return data
