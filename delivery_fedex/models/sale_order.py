# -*- coding: utf-8 -*-
from openerp import models, fields


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    delivery_price = fields.Float(store=True)

# FIXME RIM in master: move this hack to module delivery
