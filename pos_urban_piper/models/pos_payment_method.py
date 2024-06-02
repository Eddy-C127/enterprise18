from odoo import models, fields


class PosPaymentMethod(models.Model):
    _inherit = 'pos.payment.method'

    is_delivery_payment = fields.Boolean(
        string='Delivery Payment',
        help='Check this if this payment method is used for online delivery orders.'
    )
    delivery_provider = fields.Selection([
        ('zomato', 'Zomato'),
        ('swiggy', 'Swiggy')
    ], string='Delivery Provider', help='Delivery provider for the payment method.')
