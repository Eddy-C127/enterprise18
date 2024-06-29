import base64
import re
import contextlib

from odoo import api, models, Command
from odoo.addons.product_barcodelookup.tools import barcode_lookup_service
from odoo.tools import check_barcode_encoding

BARCODE_WEIGHT_REGEX = r'^((?P<weight>(\d*\.?\d+))([\s?]*)(?P<unit>(([a-zA-Z]*))))$'


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    @api.onchange('barcode')
    def _onchange_barcode(self):
        for product in self:
            if self.env.user.has_group('base.group_system') and product.barcode and len(product.barcode) > 7:
                barcode_lookup_data = self.barcode_lookup(product.barcode)
                product._update_product_by_barcodelookup(product, barcode_lookup_data)

    def _to_float(self, value):
        try:
            return float(value or 0)
        except ValueError:
            return 0

    @api.model
    def _update_product_by_barcodelookup(self, product, barcode_lookup_data):
        product.ensure_one()
        if not barcode_lookup_data:
            return
        products = barcode_lookup_data.get('products')
        # if no result or multi result ignore it
        if not products or len(products) > 1:
            return False
        product_data = products[0]

        if images := product_data.get('images'):
            for image in images:
                img_response = barcode_lookup_service.barcode_lookup_request(image)
                if img_response and not product.image_1920:
                    product.image_1920 = base64.b64encode(img_response.content)
                elif img_response and 'product_template_image_ids' in self.env['product.template']:
                    self.product_template_image_ids = [Command.create({
                        'name': product_data.get('title'),
                        'image_1920': base64.b64encode(img_response.content),
                        'product_tmpl_id': self.id,
                    })]

        if not product.weight and (barcode_lookup_weight := product_data.get('weight', '')):
            weight_re_match = re.match(BARCODE_WEIGHT_REGEX, barcode_lookup_weight)
            if weight_re_match:
                weight_dict = weight_re_match.groupdict()
                weight = self._to_float(weight_dict.get('weight'))
                if unit := weight_dict.get('unit'):
                    uom = self.env['uom.uom'].search([
                        ('name', 'like', unit)
                    ], limit=1)
                    if uom:
                        weight = uom._compute_quantity(
                            weight,
                            to_unit=self._get_weight_uom_id_from_ir_config_parameter(),
                        )
                product.weight = weight

        if (not self.list_price or self.list_price == 1.00) and (stores := product_data.get('stores')):
            for store in stores:
                if store.get('currency') == self.currency_id.name:
                    product.list_price = self._to_float(store.get('price'))
                    break
            else:
                product_currency_id = self.env['res.currency'].with_context(active_test=False).search([
                    ('name', '=', stores[0].get('currency')),
                ], limit=1)
                product.list_price = product_currency_id._convert(
                    self._to_float(stores[0].get('price')),
                    self.currency_id,
                )

        if product._name == 'product.template' and self.env.user.has_group('product.group_product_variant') and not product.attribute_line_ids:
            attribute_lines = []
            for attr_name in ['color', 'gender', 'material', 'pattern', 'manufacturer', 'brand', 'size']:
                attr_value = product_data.get(attr_name)
                if not attr_value:
                    continue
                attribute = self.env['product.attribute'].search([
                    ('name', 'ilike', attr_name),
                ], limit=1)
                if attribute and (attr_name != 'color' or attr_value.replace(' ', '').isalpha()):
                    attribute_value = self.env['product.attribute.value'].search([
                        ('name', 'ilike', attr_value),
                        ('attribute_id', '=', attribute.id)
                    ], limit=1)
                    if not attribute_value:
                        attribute_value = self.env['product.attribute.value'].create({
                            'name': attr_value.capitalize(),
                            'attribute_id': attribute.id,
                        })
                    attribute_lines.append(Command.create({
                        'attribute_id': attribute.id,
                        'value_ids': [Command.link(attribute_value.id)],
                    }))
            product.attribute_line_ids = attribute_lines

        if not product.id and (category := product_data.get('category')):
            if category := self.env['product.category'].search([('name', 'ilike', category)], limit=1):
                product.categ_id = category

        if not product.name:
            product.name = product_data.get('title')

        if not product.volume:
            if (product_data.get('length') and product_data.get('width') and product_data.get('height')):
                with contextlib.suppress(ValueError):
                    product.volume = float(product_data.get('length')) * float(product_data.get('width')) * float(product_data.get('height'))

        if not product.description:
            product.description = product_data.get('description')

    @api.model
    def barcode_lookup(self, barcode=False):
        api_key = barcode_lookup_service.get_barcode_lookup_key(self)
        if not api_key:
            return False
        if barcode and not self.env.context.get("skip_barcode_check", False) \
                and not any(check_barcode_encoding(barcode, enc) for enc in ("upca", "ean8", "ean13")):
            return False
        params = {'barcode': barcode, 'key': api_key}
        response = barcode_lookup_service.barcode_lookup_request('https://api.barcodelookup.com/v3/products', params)
        return response.json() if not isinstance(response, dict) else response
