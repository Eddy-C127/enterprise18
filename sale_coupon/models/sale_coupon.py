# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import uuid
from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _


class SaleCoupon(models.Model):
    _name = 'sale.coupon'
    _description = "Sales Coupon"
    _rec_name = 'code'

    @api.model
    def _generate_code(self):
        """Generate a 20 char long pseudo-random string of digits
        Used for barcode generation, UUID4 makes the chance of a collision
        (unicity constraint) highly unlikely.
        Using the int version is a longer string than hex but generates a more
        compact barcode when using digits only (Code128C instead of Code128A).
        Keep only the first 8 bytes as a 16 bytes barcode is not readable by all
        barcode scanners.
         """
        return str(int(uuid.uuid4().bytes[:8].encode('hex'), 16))

    code = fields.Char(default=_generate_code, required=True, readonly=True)
    expiration_date = fields.Date('Expiration Date', compute='_compute_expiration_date')
    state = fields.Selection([
        ('reserved', 'Reserved'),
        ('new', 'Valid'),
        ('used', 'Consumed'),
        ('expired', 'Expired')
        ], required=True, default='new')
    partner_id = fields.Many2one('res.partner', "For Customer")
    program_id = fields.Many2one('sale.coupon.program', "Program")
    order_id = fields.Many2one('sale.order', 'Order Reference', readonly=True,
        help="The sales order from which coupon is generated")
    discount_line_product_id = fields.Many2one('product.product', related='program_id.discount_line_product_id',
        help='Product used in the sales order to apply the discount.')

    _sql_constraints = [
        ('unique_coupon_code', 'unique(code)', 'The coupon code must be unique!'),
    ]

    def _compute_expiration_date(self):
        for coupon in self.filtered(lambda x: x.program_id.validity_duration > 0):
            coupon.expiration_date = fields.Date.from_string(coupon.create_date) + relativedelta(days=coupon.program_id.validity_duration)

    def _check_coupon_code(self, order):
        message = {}
        applicable_programs = order._get_applicable_programs()
        amount_total = order.amount_untaxed + order.reward_amount
        if self.program_id.rule_minimum_amount_tax_inclusion == 'tax_included':
            amount_total += order.amount_tax
        elif self.state in ('used', 'expired') or \
           (self.expiration_date and self.expiration_date < order.date_order):
            message = {'error': _('This coupon %s has been used or is expired.') % (self.code)}
        elif self.state == 'reserved':
            message = {'error': _('This coupon %s exists but the origin sales order is not validated yet.') % (self.code)}
        elif self.program_id._compute_program_amount('rule_minimum_amount', order.currency_id) > amount_total:
            message = {'error': _('A minimum of %s %s should be purchased to get the reward') % (self.program_id.rule_minimum_amount, self.program_id.currency_id.name)}
        elif not self.program_id.active:
            message = {'error': _('The coupon program for %s is in draft or closed state') % (self.code)}
        elif self.partner_id and self.partner_id != order.partner_id:
            message = {'error': _('Invalid partner.')}
        elif self.program_id in order.applied_coupon_ids.mapped('program_id'):
            message = {'error': _('A Coupon is already applied for the same reward')}
        elif self.program_id._is_global_discount_program() and order._is_global_discount_already_applied():
            message = {'error': _('Global discounts are not cumulable.')}
        elif self.program_id.reward_type == 'product' and not order._is_reward_in_order_lines(self.program_id):
            message = {'error': _('The reward products should be in the sales order lines to apply the discount.')}
        else:
            if self.program_id not in applicable_programs and self.program_id.promo_applicability == 'on_current_order':
                message = {'error': _('At least one of the required conditions is not met to get the reward!')}
        return message
