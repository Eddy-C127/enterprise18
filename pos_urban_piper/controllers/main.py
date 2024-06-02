import logging

from odoo import http, Command
from odoo.http import request
from odoo.tools import consteq
from odoo.tools.json import scriptsafe as json
from odoo.addons.pos_urban_piper import const
from .data_validator import object_of, list_of

from werkzeug import exceptions

_logger = logging.getLogger(__name__)

order_data_schema = object_of({
    'order': object_of({
        'items': list_of(object_of({
            'title': True,
            'price': True,
            'merchant_id': True,
            'quantity': True,
        })),
        'details': object_of({
            'order_subtotal': True,
            'total_taxes': True,
            'order_state': True,
            'channel': True,
            'id': True,
        }),
        'payment': True,
        'store': object_of({
            'merchant_ref_id': True,
        }),
    }),
    'customer': object_of({
        'name': True,
        'email': True,
        'phone': True,
        'address': True,
    }),
})

order_status_update_schema = object_of({
    'order_id': True,
    'new_state': True,
    'store_id': True,
})

rider_status_update_schema = object_of({
    'delivery_info': object_of({
        'current_state': True,
        'delivery_person_details': object_of({
            'name': True,
            'phone': True,
        }),
        'order_id': True,
        'store': object_of({
            'ref_id': True,
        }),
    }),
})


class PosUrbanPiperController(http.Controller):

    @http.route('/urbanpiper/webhook/<string:event_type>', type='json', methods=['POST'], auth='public')
    def webhook(self, event_type):
        if not consteq(request.httprequest.headers.get('X-Urbanpiper-Uuid'), request.env['ir.config_parameter'].sudo().get_param('pos_urban_piper.uuid')):
            # Ignore request if it's not from the same database
            return
        data = request.get_json_data()
        if event_type == 'order_placed':
            self._handle_data(data, order_data_schema, self._create_order, event_type)
        elif event_type == 'order_status_update':
            self._handle_data(data, order_status_update_schema, self._order_status_update, event_type)
        elif event_type == 'rider_status_update':
            self._handle_data(data, rider_status_update_schema, self._rider_status_update, event_type)

    def _handle_data(self, data, schema, handler, event_type):
        is_valid, error = schema(data)
        pos_config = request.env['pos.config']
        if is_valid:
            if event_type == 'order_placed':
                pos_config_sudo = request.env['pos.config'].sudo().search([
                    ('urbanpiper_store_identifier', '=', data['order']['store']['merchant_ref_id'])
                ])
                if not pos_config_sudo:
                    _logger.warning("UrbanPiper: Store not found for order %r", data['order'].get('id'))
                    pos_config.log_xml("UrbanPiper: - %s" % (data), 'urbanpiper_webhook_store_not_found')
                    return exceptions.BadRequest()
                if not pos_config_sudo.current_session_id:
                    _logger.warning("UrbanPiper: Session is not open for %r", pos_config_sudo.name)
                    pos_config.log_xml("UrbanPiper: - %s" % (data), 'urbanpiper_webhook_session_not_open%s')
                    return exceptions.BadRequest()
            handler(data)
        else:
            pos_config.log_xml("Payload - %s. Error - %s" % (data, error), 'urbanpiper_webhook_%s' % (event_type))
            _logger.warning("UrbanPiper: %r", error)

    def _currency_convert(self, value):
        return request.env.ref('base.INR')._convert(
                value,
                request.env.company.currency_id,
                round=False,
            )

    def _create_order(self, data):
        order = data['order']
        customer = data['customer']
        customer_address = customer['address']
        details = order['details']
        pos_config_sudo = request.env['pos.config'].sudo().search([
            ('urbanpiper_store_identifier', '=', order['store']['merchant_ref_id'])
        ])
        customer_sudo = request.env['res.partner'].sudo().search(
            ['|', ('phone', '=', customer['phone']), ('mobile', '=', customer['phone'])]
        )
        if not customer_sudo:
            customer_sudo = request.env['res.partner'].sudo().create({
                'name': customer['name'],
                'phone': customer['phone'],
                'email': customer['email'],
                'mobile': customer['phone'],
                'street': customer_address.get('line_1'),
                'street2': customer_address.get('line_2'),
                'city': customer_address.get('city'),
                'zip': customer_address.get('pin'),
            })
        else:
            if customer_sudo.zip != customer_address.get('zip'):
                customer_sudo.write({
                    'street': customer_address.get('line_1'),
                    'street2': customer_address.get('line_2'),
                    'zip': customer_address.get('pin'),
                    'city': customer_address.get('city'),
                })
        order_reference = request.env['pos.order']._generate_unique_reference(
            pos_config_sudo.current_session_id.id,
            pos_config_sudo.id,
            pos_config_sudo.current_session_id.sequence_number,
            order['details']['channel'].capitalize()
        )

        def get_prep_time(details):
            data = details.get('prep_time')
            if data:
                return data.get('estimated') or data.get('max')

        lines = [self._create_order_line(line) for line in order['items']]
        delivery_order = request.env["pos.order"].sudo().create({
            'name': order_reference,
            'partner_id': customer_sudo.id,
            'pos_reference': order_reference,
            'tracking_number': str((pos_config_sudo.current_session_id.id % 10) * 100 + pos_config_sudo.current_session_id.sequence_number % 100).zfill(3),
            'config_id': pos_config_sudo.id,
            'session_id': pos_config_sudo.current_session_id.id,
            'company_id': pos_config_sudo.company_id.id,
            'fiscal_position_id': pos_config_sudo.urbanpiper_fiscal_position_id.id,
            'lines': lines,
            'amount_paid': self._currency_convert(details['order_subtotal']),
            'amount_total': self._currency_convert(details['order_subtotal']),
            'amount_tax': self._currency_convert(details['total_taxes']),
            'amount_return': 0.0,
            'delivery_identifier': details['id'],
            'delivery_status': details['order_state'].lower(),
            'delivery_channel': details['channel'].capitalize(),
            'delivery_note': details.get('instructions'),
            'prep_time': get_prep_time(details),
            'delivery_json': json.dumps(data),
            'user_id':  pos_config_sudo.current_session_id.user_id.id,
        })
        pos_config_sudo.current_session_id.sequence_number += 1
        pos_config_sudo._send_delivery_order_count(delivery_order.id)

    def _create_order_line(self, line_data):
        value_ids_lst = []
        if line_data.get('options_to_add'):
            merchant_value_lst = [option.get('merchant_id') for option in line_data['options_to_add']]
            value_ids_lst = [int(vid.split('-')[1]) for vid in merchant_value_lst]
        price_extra = sum(option.get('price', 0) for option in line_data.get('options_to_add', []))
        attribute_value_ids = []
        values_to_remove = []
        if value_ids_lst:
            for value in value_ids_lst:
                value_id = request.env['product.attribute.value'].sudo().browse(value)
                if value_id.attribute_id.create_variant == 'no_variant' or value_id.attribute_id.display_type == 'multi':
                    product_option = request.env['product.template.attribute.value'].sudo().search([
                        ('product_tmpl_id', '=', int(line_data['merchant_id'].split('-')[0])),
                        ('product_attribute_value_id', '=', value)
                    ])
                    if product_option:
                        attribute_value_ids.append(product_option.id)
                    values_to_remove.append(value)
        variant_value_lst = [value for value in value_ids_lst if value not in values_to_remove]
        tax_lst = []
        for tax_line in line_data.get('taxes'):
            tax = request.env['account.tax'].sudo().search([
                ('tax_group_id.name', '=', tax_line.get('title')),
                ('amount', '=', tax_line.get('rate'))
            ], limit=1)
            if tax:
                tax_lst.append(tax.id)
        parent_tax = request.env['account.tax'].sudo().search([('children_tax_ids', 'in', tax_lst)])
        main_product = self._product_template_to_product_variant(int(line_data['merchant_id'].split('-')[0]), variant_value_lst)
        lines = Command.create({
            'product_id': main_product,
            'full_product_name': line_data['title'],
            'qty': int(line_data['quantity']),
            'attribute_value_ids': attribute_value_ids,
            'price_extra': price_extra,
            'price_unit': float(self._currency_convert(int(line_data['price'])) + price_extra),
            'tax_ids': [Command.link(parent_tax.id)] if parent_tax.id else None,
            'note': line_data.get('instructions')
        })
        if line_data.get('charges'):
            package_product = self.config.env['product.template'].search([('name', '=', 'Restaurant Packaging Charges')], limit=1)
            if not package_product:
                return lines
            lines += Command.create({
                'product_id': package_product.id,
                'full_product_name': package_product.name,
                'qty': 1,
                'price_unit': line_data.get('charges') and line_data.get('charges')[0].get('value') or 0.0,
                'note': "Packaging charges for %s" % main_product.name,
                'tax_ids': package_product.taxes_id,
            })
        return lines

    def _product_template_to_product_variant(self, tmpl_id, value_ids):
        products = request.env['product.product'].sudo().search([('product_tmpl_id', '=', tmpl_id)])
        if products:
            if not value_ids:
                return products[0].id
            if len(products) == 1:
                return products[0].id
            product = products.filtered(
                lambda l: sorted(l.product_template_variant_value_ids.product_attribute_value_id.ids) == sorted(value_ids)
            )
            return product.id

    def _order_status_update(self, data):
        def _get_status_seq(status):
            return const.ORDER_STATUS_MAPPING[status][0]
        current_order_id = request.env['pos.order'].sudo().search([('delivery_identifier', '=', str(data['order_id']))])
        if not current_order_id:
            _logger.warning("UrbanPiper: Order %r not found for update the status.", data['order_id'])
            return
        if _get_status_seq(current_order_id.delivery_status.replace('_', ' ').title()) < _get_status_seq(data['new_state']):
            current_order_id.delivery_status = const.ORDER_STATUS_MAPPING[data['new_state']][1]
            pos_config_sudo = request.env['pos.config'].sudo().search([
                ('urbanpiper_store_identifier', '=', data['store_id'])
            ])
            pos_config_sudo._send_delivery_order_count()

    def _rider_status_update(self, data):
        current_order_id = request.env['pos.order'].sudo().search([('delivery_identifier', '=', str(data['order_id']))])
        if not current_order_id:
            _logger.warning("UrbanPiper: Order %r not found for update the rider status.", data['order_id'])
            return
        current_order_id.delivery_rider_json = json.dumps(data['delivery_info'])
        pos_config_sudo = request.env['pos.config'].sudo().search([
            ('urbanpiper_store_identifier', '=', data['store_ref_id'])
        ])
        pos_config_sudo._send_delivery_order_count()
