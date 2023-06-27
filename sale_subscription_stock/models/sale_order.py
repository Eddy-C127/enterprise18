# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import  fields, models


class SaleOrder(models.Model):
    _inherit = "sale.order"

    display_recurring_stock_delivery_warning = fields.Boolean(compute='_compute_recurring_stock_products')

    def _upsell_context(self):
        context = super()._upsell_context()
        context["skip_procurement"] = True
        return context

    @api.depends('state', 'is_subscription',  'start_date', 'next_invoice_date',)
    def _compute_recurring_stock_products(self):
        self.display_recurring_stock_delivery_warning = False
        for order in self:
            if order.state != 'sale' or not order.is_subscription or order.next_invoice_date > order.start_date:
                continue
            order.display_recurring_stock_delivery_warning = bool(len(order.order_line._get_stock_subscription_lines()))
