# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models


class PosSession(models.Model):
    _inherit = 'pos.session'

    def _load_data_params(self, config_id):
        params = super()._load_data_params(config_id)

        params['pos_preparation_display.display'] = {
            'domain': ['|', ('pos_config_ids', '=', self.config_id.id), ('pos_config_ids', '=', False)],
            'fields': [],
        }

        return params

    def get_onboarding_data(self):
        result = super().get_onboarding_data()

        response = self.load_data(['pos_preparation_display.display'], True)
        result.update(response['data'])

        return result
