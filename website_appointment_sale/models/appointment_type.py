# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class AppointmentType(models.Model):
    _inherit = "appointment.type"

    price_incl = fields.Float(string='Price include', compute='_compute_price_incl', digits='Product Price')

    @api.depends('product_id', 'product_id.taxes_id', 'product_id.lst_price')
    def _compute_price_incl(self):
        for appointment_type in self:
            if product := appointment_type.product_id:
                taxes = product.taxes_id.compute_all(product.lst_price, product.currency_id, product=product)
                appointment_type.price_incl = taxes['total_included']
            else:
                appointment_type.price_incl = 0.0
