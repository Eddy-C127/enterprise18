# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    def get_total_due(self, pos_currency):
        this = self
        group_pos_user = self.env.ref('point_of_sale.group_pos_user')
        if group_pos_user in self.env.user.groups_id:
            this = self.sudo()  # allow POS users without accounting rights to settle dues
        if self.env.company.currency_id.id != pos_currency:
            pos_currency = self.env['res.currency'].browse(pos_currency)
            return self.env.company.currency_id._convert(this.total_due, pos_currency, self.env.company, fields.Date.today())
        return this.total_due
