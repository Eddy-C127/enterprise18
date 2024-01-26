# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, _
from odoo.exceptions import UserError


class purchase_order(models.Model):
    _inherit = "purchase.order"

    def _prepare_sale_order_data(self, name, partner, company, direct_delivery_address):
        res = super()._prepare_sale_order_data(name, partner, company, direct_delivery_address)
        warehouse = company.intercompany_warehouse_id and company.intercompany_warehouse_id.company_id.id == company.id and company.intercompany_warehouse_id or False
        if not warehouse:
            raise UserError(_('Configure correct warehouse for company(%s) from Menu: Settings/Users/Companies', company.name))
        res['warehouse_id'] = warehouse.id

        picking_type_warehouse_partner_id = self.picking_type_id.warehouse_id.partner_id.id
        if picking_type_warehouse_partner_id:
            res['partner_shipping_id'] = picking_type_warehouse_partner_id or direct_delivery_address

        return res

    def _prepare_sale_order_line_data(self, line, company):
        res = super()._prepare_sale_order_line_data(line, company)
        if line.product_id.sale_delay:
            res['customer_lead'] = line.product_id and line.product_id.sale_delay or 0.0
        return res
