# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class CommissionPlanTargetCommission(models.Model):
    _name = 'sale.commission.plan.target.commission'
    _description = 'Commission Plan Target Commission'
    _order = 'amount, id'

    plan_id = fields.Many2one('sale.commission.plan', ondelete='cascade')

    target_rate = fields.Float("Target completion (%)", default=1, required=True)
    amount_rate = fields.Float("OTC %", help='On Target Commission rate', compute='_compute_amount_rate', inverse='_inverse_amount_rate')
    amount = fields.Monetary("Commission", default=0, required=True, currency_field='currency_id')
    currency_id = fields.Many2one('res.currency', related='plan_id.currency_id')

    @api.depends('amount', 'plan_id.commission_amount')
    def _compute_amount_rate(self):
        for commission in self:
            commission.amount_rate = commission.plan_id.commission_amount and (commission.amount / commission.plan_id.commission_amount) or commission.amount

    def _inverse_amount_rate(self):
        for commission in self:
            commission.amount = commission.plan_id.commission_amount * commission.amount_rate
