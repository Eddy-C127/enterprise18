import logging
import requests
import json

from datetime import datetime

from odoo import Command
from odoo.tools import html2plaintext

from urllib.parse import quote
from werkzeug.urls import url_join

_logger = logging.getLogger(__name__)

EVENT_TYPES = [
    'order_placed', 'order_status_update',
    'rider_status_update', 'item_state_toggle', 'store_action'
]


class UrbanPiperClient:

    def __init__(self, config):
        """
        Initial parameters for making api requests.
        """
        self.config = config
        self.session = requests.Session()
        self.db_uuid = self.config.env['ir.config_parameter'].sudo().get_param('database.uuid')

    def _make_api_request(self, endpoint, method='POST', data=None, timeout=10):
        """
        Make an api call, return response for multiple api requests of urban piper.
        """
        user_name = self.config.env['ir.config_parameter'].sudo().get_param('pos_urban_piper.urbanpiper_username')
        api_key = self.config.env['ir.config_parameter'].sudo().get_param('pos_urban_piper.urbanpiper_apikey')
        headers = {
            'Authorization': f'apikey {user_name}:{api_key}',
            'Content-Type': 'application/json'
        }
        access_url = 'https://pos-int.urbanpiper.com/' + endpoint
        try:
            # Make the API request
            response = self.session.request(method, access_url, json=data, headers=headers, timeout=timeout)
            # Parse the response as JSON
            response_json = response.json()
            return response_json
        except requests.exceptions.ConnectionError as error:
            _logger.warning('Connection Error: %r with the given URL %r', error, access_url)
            return {'errors': {'timeout': 'Cannot reach the server. Please try again later.'}}
        except json.decoder.JSONDecodeError as error:
            _logger.warning('JSONDecodeError: %r', error)
            return {'errors': {'JSONDecodeError': str(error)}}

    def configure_webhook(self):
        """
        Check and register webhook if the base url is changed.
        """
        base_url = self.config.get_base_url()
        if base_url != self.config.urbanpiper_webhook_url:
            self.config.urbanpiper_webhook_url = base_url
            self._register_webhook()

    def _register_webhook(self):
        """
        Register webhook on Atlas for get notified for order updates.
        """
        endpoint = 'external/api/v1/webhooks/'
        base_url = self.config.urbanpiper_webhook_url
        webhook_url = url_join(base_url, '/urbanpiper/webhook/')
        for event_type in EVENT_TYPES:
            controller_url = url_join(webhook_url, event_type)
            payload = {
                'active': True,
                'event_type': event_type,
                'retrial_interval_units': 'seconds',
                'url': controller_url,
                'headers': {
                    'X-Urbanpiper-Uuid': self.config.env['ir.config_parameter'].sudo().get_param('pos_urban_piper.uuid')
                }
            }
            self._make_api_request(endpoint, data=payload)

    def request_sync_menu(self):
        """
        Sync menu in urban piper.
        - Sync categories, products, attributes, values and taxes.
        """
        store_identifier = quote(self.config.urbanpiper_store_identifier, safe='')
        endpoint = f'external/api/v1/inventory/locations/{store_identifier}/'
        product_domain = [
            ('urbanpiper_pos_config_ids', 'in', self.config.ids),
            ('type', '!=', 'combo')
        ]
        products = self.config.env['product.template'].search(product_domain)
        pos_products = products.filtered(lambda product: (
            not product.urban_piper_status_ids or
            self.config.id not in product.urban_piper_status_ids.config_id.ids or
            any(ups.config_id.id in self.config.ids and not ups.is_product_linked for ups in product.urban_piper_status_ids)
        ))
        pos_packaging_product = self.config.env['product.template'].search([('name', '=', 'Restaurant Packaging Charges')], limit=1)
        if not pos_packaging_product:
            self.config.env['product.template'].create({
                'name': 'Restaurant Packaging Charges',
                'type': 'service',
                'list_price': 0,
                'available_in_pos': 1,
            })
        pos_products_without_pos_categ_ids = pos_products.filtered(lambda p: not p.pos_categ_ids)
        pos_other_categ_id = self.config.env['pos.category'].search([('name', 'ilike', 'other')], limit=1)
        if not pos_other_categ_id:
            pos_other_categ_id = self.config.env['pos.category'].create({
                'name': 'Other',
            })
        pos_products_without_pos_categ_ids.pos_categ_ids = pos_other_categ_id
        pos_categories = pos_products.pos_categ_ids
        pos_attribute_products = pos_products.filtered(lambda p: p.attribute_line_ids)
        payload = {
            'flush_categories': False,
            'categories': self._prepare_categories_data(pos_categories),                      # pos categories
            'flush_items': False,
            'items': self._prepare_items_data(pos_products),                                  # pos products
            'flush_option_groups': False,
            'option_groups': self._prepare_option_groups_data(pos_attribute_products),        # pos attributes
            'flush_options': False,
            'options': self._prepare_option_data(pos_attribute_products),                     # pos attribute values
            'flush_taxes': False,
            'taxes': self._prepare_taxes_data(pos_products)                                   # pos taxes
        }
        # If we have multiple products, we should increase the timeout to 90 seconds.
        response_json = self._make_api_request(endpoint, method='POST', data=payload, timeout=90)
        if response_json.get('status') == 'success':
            # logic for updating the status of the product in atlas based on config
            for product in pos_products:
                if (not product.urban_piper_status_ids or product.urban_piper_status_ids and
                        self.config.id not in product.urban_piper_status_ids.config_id.ids):
                    product.write({
                        'urban_piper_status_ids': [Command.create({
                            'product_tmpl_id': product.id,
                            'is_product_linked': True,
                            'config_id': self.config.id
                        })]
                    })
                elif product.urban_piper_status_ids and self.config.id in product.urban_piper_status_ids.config_id.ids:
                    product.urban_piper_status_ids.filtered(lambda p: p.config_id == self.config).write({
                        'is_product_linked': True
                    })
        if response_json.get('status') == 'success':
            self.config.urbanpiper_last_sync_date = datetime.now()
        return response_json

    def get_item_ref_id(self, product):
        return f'{product.id}-{self.db_uuid[0:5]}'

    def _prepare_categories_data(self, pos_categories):
        """
        Prepare categories data for urban piper.
        """
        category_lst = []
        for category in pos_categories:
            category_lst.append({
                'ref_id': str(category.id),
                'name': category.name,
                'sort_order': category.sequence,
                'active': True,
                'img_url': self._get_public_image_url(category),
            })
        return category_lst

    def _prepare_items_data(self, pos_products):
        """
        Prepare product data for urban piper.
        """
        item_lst = []
        for product in pos_products:
            product_price = product.list_price if not self.config.urbanpiper_pricelist_id \
                else self.config.urbanpiper_pricelist_id._get_product_price(
                product, 1.0, uom=product.uom_id
            )
            item_lst.append({
                'ref_id': self.get_item_ref_id(product),
                'title': product.name,
                'description': html2plaintext(product.public_description) if product.public_description else '',
                'price': product.taxes_id.compute_all(
                    product_price, product.currency_id, 1)['total_excluded'],
                'weight': product.weight,
                'food_type': product.urbanpiper_meal_type,
                'category_ref_ids': [str(i) for i in product.pos_categ_ids.ids],
                'recommended': product.is_recommended_on_urbanpiper,
                'img_url': self._get_public_image_url(product),
                'available': True,
            })
        return item_lst

    def _prepare_option_groups_data(self, pos_products):
        """
        Prepare option groups data for urban piper.
        - Attributes are option groups.
        """
        attribute_lst = []
        for product in pos_products:
            for attr_line in product.attribute_line_ids:
                group = {
                    'ref_id': f'{product.id}-{attr_line.attribute_id.id}',
                    'title': attr_line.attribute_id.name,
                    'active': True,
                    'multi_options_enabled': bool(attr_line.attribute_id.display_type == 'multi'),
                    'item_ref_ids': [self.get_item_ref_id(product)]
                }
                if attr_line.attribute_id.display_type != 'multi':
                    group['min_selectable'] = 1
                    group['max_selectable'] = 1
                attribute_lst.append(group)
        return attribute_lst

    def _prepare_option_data(self, pos_products):
        """
        Prepare options data for urban piper.
        - Attribute values are options.
        """
        value_lst = []
        for product in pos_products:
            for option_group in product.attribute_line_ids:
                for option in option_group.value_ids:
                    product_option = self.config.env['product.template.attribute.value'].search([
                        ('product_tmpl_id', '=', product.id),
                        ('product_attribute_value_id', '=', option.id)
                    ])
                    value_lst.append({
                        'ref_id': f'{product.id}-{option.id}',
                        'title': option.name,
                        'available': True,
                        'opt_grp_ref_ids': [f'{product.id}-{i}' for i in option.attribute_id.ids],
                        'price': product_option.price_extra or option.default_extra_price
                    })
        return value_lst

    def _prepare_taxes_data(self, pos_products):
        """
        Prepare taxes data for urban piper.
        """
        tax_lst = []
        for tax in pos_products.taxes_id:
            if tax.type_tax_use == 'sale' and tax.tax_group_id.name == 'GST':
                product = pos_products.filtered(lambda p: tax.id in p.taxes_id.ids)
                tax_lines = tax.flatten_taxes_hierarchy()
                for tax in tax_lines:
                    if tax.tax_group_id.name in ['SGST', 'CGST']:
                        tax_lst.append(
                            {
                                'code': f'{tax.tax_group_id.name}_P',
                                'title': tax.tax_group_id.name,
                                'description': f'{tax.amount}% {tax.tax_group_id.name} on product price.',
                                'active': True,
                                'structure': {
                                    'value': tax.amount
                                },
                                'item_ref_ids': [self.get_item_ref_id(p) for p in product]
                            }
                        )
        return tax_lst

    def register_item_toggle(self, products, status):
        """
        Enable/Disable product on urban piper store. (If menu is synced with urban piper)
        """
        product_lst_str = [self.get_item_ref_id(product) for product in products]
        endpoint = 'hub/api/v1/items/'
        payload = {
            'location_ref_id': self.config.urbanpiper_store_identifier,
            'item_ref_ids': product_lst_str,
            'option_ref_ids': [],
            'action': 'enable' if status else 'disable'
        }
        response_json = self._make_api_request(endpoint, method='POST', data=payload)
        return response_json

    def request_status_update(self, order_id, new_status, message=None):
        """
        Update status in Urban Piper
        """
        endpoint = f'external/api/v1/orders/{order_id}/status/'
        payload = {
            'new_status': new_status,
            'reason_code': message
        }
        response_json = self._make_api_request(endpoint, method='PUT', data=payload)
        if response_json:
            if response_json.get('status') == 'success':
                return True, ''
            else:
                return False, response_json.get('message')
        else:
            return False, 'Failed to update status in Urban Piper'

    def urbanpiper_store_status_update(self, status):
        """
        Change store status in urban piper.
        """
        for platform in ['zomato', 'swiggy']:
            payload = {
                'location_ref_id': self.config.urbanpiper_store_identifier,
                'platforms': [platform],
                'action': status and 'enable' or 'disable',
            }
            response_json = self._make_api_request('hub/api/v1/location/', data=payload)
            return response_json

    def _get_public_image_url(self, record):
        """
        Get public image url for the product and categories.
        """
        base_url = self.config.urbanpiper_webhook_url
        attachment = record.env['ir.attachment'].search([
            ('res_model', '=', record._name),
            ('res_id', '=', record.id),
            ('type', '=', 'binary'),
            ('public', '=', True),
        ], limit=1)
        if attachment:
            attachment.datas = record.image_1920 if record._name == 'product.template' else record.image_128
        else:
            attachment = record.env['ir.attachment'].create({
                'name': f'{record.name}.png',
                'type': 'binary',
                'datas': record.image_1920 if record._name == 'product.template' else record.image_128,
                'res_model': record._name,
                'res_id': record.id,
                'public': True,
            })
        local_url = attachment.local_url + '.png'
        return url_join(base_url, local_url)

    def request_refresh_webhooks(self):
        """
        If customer uses multi db on the same URL. UrbanPiper only stores one webhook per URL.
        When the user switches the database, they can press the refresh webhook button to
        update the webhook parameters according to the new database.
        """
        wehbook_json = self._make_api_request('external/api/v1/webhooks?limit=50', method='GET')
        webhooks = wehbook_json.get('webhooks')
        response_json = {}
        if webhooks:
            for webhook in webhooks:
                if self.config.urbanpiper_webhook_url and self.config.urbanpiper_webhook_url in webhook.get('url'):
                    payload = {
                        'active': True,
                        'event_type': webhook.get('event_type'),
                        'retrial_interval_units': 'seconds',
                        'url': webhook.get('url'),
                        'headers': {
                            'X-Urbanpiper-Uuid': self.config.env['ir.config_parameter'].sudo().get_param('pos_urban_piper.uuid')
                        }
                    }
                    wehbook_id = webhook.get('webhook_id')
                    response_json = self._make_api_request(f'external/api/v1/webhooks/{wehbook_id}/', data=payload, method='PUT')
        return response_json
