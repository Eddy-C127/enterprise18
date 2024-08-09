# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models, api


class ResPartner(models.Model):
    _inherit = 'res.partner'

    def get_total_due(self, pos_currency):
        total_due = self.parent_id.total_due if self.parent_id else self.total_due
        if self.env.company.currency_id.id != pos_currency:
            pos_currency = self.env['res.currency'].browse(pos_currency)
            return self.env.company.currency_id._convert(total_due, pos_currency, self.env.company, fields.Date.today())
        return total_due

    @api.model
    def _load_pos_data_fields(self, config_id):
        params = super()._load_pos_data_fields(config_id)
        if self.env.user.has_group('account.group_account_readonly'):
            params += ['credit_limit', 'total_due', 'use_partner_credit_limit']
        return params

    def _load_pos_data(self, data):
        response = super()._load_pos_data(data)
        config_id = self.env['pos.config'].browse(data['pos.config']['data'][0]['id'])

        if config_id.currency_id != self.env.company.currency_id and self.env.user.has_group('account.group_account_readonly'):
            for partner in response['data']:
                partner['total_due'] = self.env.company.currency_id._convert(partner['total_due'], config_id.currency_id, self.env.company, fields.Date.today())

        return response
