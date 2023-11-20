# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class PosSession(models.Model):
    _inherit = 'pos.session'

    def _load_data_params(self, config_id):
        params = super()._load_data_params(config_id)

        if self.user_has_groups('account.group_account_readonly'):
            params['res.partner']['fields'] += ['credit_limit', 'total_due', 'use_partner_credit_limit']
            params['res.company']['fields'] += ['account_use_credit_limit']

        return params

    def load_data(self, models_to_load, only_data=False):
        response = super().load_data(models_to_load, only_data)

        if self.config_id.currency_id != self.env.company.currency_id and self.user_has_groups('account.group_account_readonly'):
            for partner in response['data']['res.partner']:
                partner['total_due'] = self.env.company.currency_id._convert(partner['total_due'], self.config_id.currency_id, self.env.company, fields.Date.today())

        return response
