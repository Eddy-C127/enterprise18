# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class BankRecWidgetLine(models.Model):
    _inherit = 'bank.rec.widget.line'

    source_batch_payment_id = fields.Many2one(comodel_name='account.batch.payment')
    flag = fields.Selection(selection_add=[('new_batch', 'new_batch')])
    batch_pay_content = fields.Json()
    source_batch_payment_name = fields.Char()
