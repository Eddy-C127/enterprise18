from odoo import api, models


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    @api.model
    def _update_product_by_barcodelookup(self, product, barcode_lookup_data):
        product.ensure_one()
        description = super()._update_product_by_barcodelookup(product, barcode_lookup_data)
        product.description_ecommerce = description
