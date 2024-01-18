# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.tools import format_amount


class product_template(models.Model):
    _inherit = "product.template"

    recurring_invoice = fields.Boolean(
        'Subscription Product',
        help='If set, confirming a sale order with this product will create a subscription')

    product_subscription_pricing_ids = fields.One2many('sale.subscription.pricing', 'product_template_id', string="Custom Subscription Pricings", auto_join=True, copy=True)
    display_subscription_pricing = fields.Char('Display Price', compute='_compute_display_subscription_pricing')

    @api.model
    def _get_incompatible_types(self):
        return ['recurring_invoice'] + super()._get_incompatible_types()

    @api.onchange('recurring_invoice')
    def _onchange_recurring_invoice(self):
        """
        Raise a warning if the user has checked 'Subscription Product'
        while the product has already been sold.
        In this case, the 'Subscription Product' field is automatically
        unchecked.
        """
        confirmed_lines = self.env['sale.order.line'].search([
            ('product_template_id', 'in', self.ids),
            ('state', '=', 'sale')])
        if confirmed_lines:
            self.recurring_invoice = True
            return {'warning': {
                'title': _("Warning"),
                'message': _(
                    "You can not change the recurring property of this product because it has been sold already.")
            }}

    @api.depends('product_subscription_pricing_ids')
    def _compute_display_subscription_pricing(self):
        for record in self:
            if record.product_subscription_pricing_ids:
                display_pricing = record.product_subscription_pricing_ids[0]
                formatted_price = format_amount(self.env, display_pricing.price, display_pricing.currency_id)
                record.display_subscription_pricing = _('%s %s', formatted_price, display_pricing.plan_id.billing_period_display_sentence)
            else:
                record.display_subscription_pricing = None
