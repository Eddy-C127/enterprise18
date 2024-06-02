from odoo import models, api


class ProductPricelist(models.Model):
    _inherit = 'product.pricelist'

    @api.model
    def write(self, vals):
        res = super().write(vals)
        urban_piper_pricelist = self.env.ref('pos_urban_piper.pos_product_pricelist_urbanpiper', False)
        if urban_piper_pricelist and vals.get('item_ids') and urban_piper_pricelist in self:
            linked_urban_piper_status = self.env['product.template'].search([('urbanpiper_pos_config_ids', '!=', False)])\
                .mapped('urban_piper_status_ids')\
                .filtered(lambda s: s.is_product_linked)
            linked_urban_piper_status.write({'is_product_linked': False})
        return res
