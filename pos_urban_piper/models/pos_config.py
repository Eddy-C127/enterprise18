import secrets
import psycopg2

from odoo import fields, models, registry, api, SUPERUSER_ID, _
from odoo.exceptions import ValidationError, UserError
from odoo.tools import SQL
from odoo.addons.pos_urban_piper import const

from .pos_urban_piper_request import UrbanPiperClient


class PosConfig(models.Model):
    _inherit = 'pos.config'

    def _default_payment_methods(self):
        """
        Override default payment methods to filter out delivery payment methods.
        """
        payment_methods = super()._default_payment_methods()
        return payment_methods.filtered(lambda pm: not pm.is_delivery_payment)

    def _default_urbanpiper_store_identifier(self):
        """
        Default unique Urban Piper POS ID.
        """
        return secrets.token_hex()

    def _default_urbanpiper_pricelist_id(self):
        return self.env.ref('pos_urban_piper.pos_product_pricelist_urbanpiper', False)

    def _default_urbanpiper_fiscal_position_id(self):
        return self.env.ref('pos_urban_piper.pos_account_fiscal_position_urbanpiper', False)

    urbanpiper_store_identifier = fields.Char(
        string='Urban Piper POS ID',
        help='Pos ID from Urban Piper (Atlas)',
        default=_default_urbanpiper_store_identifier,
        copy=False,
    )
    urbanpiper_pricelist_id = fields.Many2one(
        'product.pricelist',
        string='Urban Piper Pricelist',
        help='Pricelist for Urban Piper sync menu.',
        default=_default_urbanpiper_pricelist_id,
    )
    urbanpiper_fiscal_position_id = fields.Many2one(
        'account.fiscal.position',
        string='Urban Piper Fiscal Position',
        help='Fiscal position for Urban Piper sync menu.',
        default=_default_urbanpiper_fiscal_position_id,
    )
    urbanpiper_payment_methods_ids = fields.Many2many(
        'pos.payment.method',
        'pos_config_urbanpiper_payment_method_ids_rel', 'config_id',
        string='Urban Piper Payment Methods',
        help='Payment methods for Urban Piper sync menu.'
    )
    urbanpiper_last_sync_date = fields.Datetime(string='Last Sync on', help='Last sync date for menu sync.')
    urbanpiper_webhook_url = fields.Char(
        string='Register Urbanpiper Webhook URL',
        help='Store webhook url (base url) for security.'
    )

    _sql_constraints = [('urbanpiper_store_identifier_uniq',
                         'unique(urbanpiper_store_identifier)',
                         'Store ID must be unique for every pos configuration.')]

    def _init_column(self, column_name):
        if column_name != 'urbanpiper_store_identifier':
            return super()._init_column(column_name)
        # fetch void columns
        self.env.cr.execute(SQL("SELECT id FROM pos_config WHERE urbanpiper_store_identifier IS NULL"))
        pos_config_ids = self.env.cr.fetchall()
        if not pos_config_ids:
            return
        # update existing columns
        for pos_config_id in pos_config_ids:
            self.env.cr.execute(SQL(
                """
                UPDATE pos_config SET urbanpiper_store_identifier = %s WHERE id = %s;
                """,
                self._default_urbanpiper_store_identifier(),
                pos_config_id[0]
            ))

    def open_ui(self):
        if self.module_pos_urban_piper and self.urbanpiper_store_identifier and self.current_session_id:
            self.update_store_status(True)
        return super().open_ui()

    @api.model_create_multi
    def create(self, vals_list):
        pos_configs = super().create(vals_list)
        for config in pos_configs:
            if config.module_pos_urban_piper:
                config.setup_journals_and_payment_methods()
                config._configure_fiscal_position_and_pricelist()
        return pos_configs

    def write(self, vals):
        res = super().write(vals)
        for config in self:
            if (config.module_pos_urban_piper or vals.get('module_pos_urban_piper')) and vals.get('urbanpiper_store_identifier'):
                if not config.urbanpiper_payment_methods_ids:
                    config._setup_journals_and_payment_methods()
                config._configure_fiscal_position_and_pricelist()
        return res

    def _setup_journals_and_payment_methods(self):
        """
        Fetch or create payment methods and enable option fiscal taxes.
        """
        self.ensure_one()
        journals = [
            {'name': 'Zomato', 'code': 'ZMT'},
            {'name': 'Swiggy', 'code': 'SWY'},
        ]
        for journal_info in journals:
            journal = self.env['account.journal'].sudo().search([
                ('code', '=', f"{journal_info['code']}{self.id}"),
                ('company_id', '=', self.company_id.id),
            ], limit=1)
            if not journal:
                journal = self.env['account.journal'].sudo().create({
                    'name': f"{journal_info['name']} - {self.name}",
                    'code': f"{journal_info['code']}{self.id}",
                    'type': 'bank',
                    'company_id': self.company_id.id,
                })
            payment_method = self.env['pos.payment.method'].sudo().search([
                ('journal_id', '=', journal.id),
                ('is_delivery_payment', '=', True),
                ('delivery_provider', '=', journal_info['name'].lower()),
            ], limit=1)
            if not payment_method:
                payment_method = self.env['pos.payment.method'].sudo().create({
                    'name': f"{journal_info['name']} - {self.name}",
                    'journal_id': journal.id,
                    'company_id': self.company_id.id,
                    'is_delivery_payment': True,
                    'delivery_provider': journal_info['name'].lower()
                })
            self.urbanpiper_payment_methods_ids |= payment_method

    def _configure_fiscal_position_and_pricelist(self):
        """
        Set taxes in fiscal position for urban piper.
        """
        self.ensure_one()
        fiscal_position = self.env.ref('pos_urban_piper.pos_account_fiscal_position_urbanpiper', False)
        if self.module_pos_urban_piper:
            if not self.urbanpiper_fiscal_position_id:
                self.urbanpiper_fiscal_position_id = fiscal_position
            if not self.urbanpiper_pricelist_id:
                self.urbanpiper_pricelist_id = self.env.ref('pos_urban_piper.pos_product_pricelist_urbanpiper', False)
        source_taxes = self.env['account.tax'].search([('type_tax_use', '=', 'sale'), ('company_id', '=', self.company_id.id)])
        if fiscal_position and fiscal_position.tax_ids.tax_src_id.ids != source_taxes.ids:
            lines = []
            for tax in source_taxes - fiscal_position.tax_ids.tax_src_id:
                lines.append((0, 0, {
                    'tax_src_id': tax.id,
                }))
            fiscal_position.tax_ids = lines

    def update_store_status(self, status):
        """
        Activate and Deactivate store
        """
        self._check_required_request_params()
        up = UrbanPiperClient(self)
        up.configure_webhook()
        up.urbanpiper_store_status_update(status=status)

    def order_status_update(self, order_id, new_status, message=None):
        """
        Update order status from urban piper webhook
        """
        self.ensure_one()
        order = self.env['pos.order'].browse(order_id)
        if new_status == 'Food Ready':
            self._make_order_payment(order)
        up = UrbanPiperClient(self)
        is_success, message = up.request_status_update(order.delivery_identifier, new_status, message)
        if is_success:
            order.write({
                'delivery_status': const.ORDER_STATUS_MAPPING[new_status][1],
            })
        self._send_delivery_order_count()
        return {'is_success': is_success, 'message': message}

    def _make_order_payment(self, order):
        """
        Make payment for order of urban piper orders.
        """
        self.ensure_one()
        payment_method = self.urbanpiper_payment_methods_ids.filtered(lambda pm: pm.delivery_provider == order.delivery_channel.lower())
        if not payment_method:
            payment_method = self.urbanpiper_payment_methods_ids[0]
        context_payment = {
            'active_ids': [order.id],
            'active_id': order.id
        }
        self.env['pos.make.payment'].with_context(context_payment).create({
            'amount': order.amount_total,
            'payment_method_id': payment_method.id,
        }).check()

    def _send_delivery_order_count(self, order_id=None):
        """
        Send delivery order count to pos ui
        """
        self.ensure_one()
        if self.current_session_id:
            self._notify('DELIVERY_ORDER_COUNT', order_id)

    def get_delivery_data(self):
        """
        Fetch delivery order count and providers for pos ui
        """
        self.ensure_one()
        delivery_order_count = self._get_urbanpiper_order_count()
        delivery_providers = self._get_active_delivery_providers()
        for provider in delivery_providers:
            provider_code = provider.get("code")
            if provider_code in delivery_order_count['urbanpiper']:
                order_counts = delivery_order_count['urbanpiper'][provider_code]
                order_count = sum(order_counts.values())
                provider['is_active'] = order_count > 0
            else:
                provider['is_active'] = False
        delivery_providers_active = any(provider['is_active'] for provider in delivery_providers)
        total_new_order = sum(
            provider_data.get('awaiting', 0)
            for provider_data in delivery_order_count['urbanpiper'].values()
        )
        combined_data = {
            'delivery_order_count': delivery_order_count,
            'delivery_providers': delivery_providers,
            'delivery_providers_active': delivery_providers_active,
            'total_new_order': total_new_order,
        }
        return combined_data

    def _get_urbanpiper_order_count(self):
        """
        Updates order count whenever order status changes and when new order receives
        """
        self.ensure_one()
        if not self.current_session_id:
            return {}
        session_id = self.current_session_id.id
        order_statuses = ['placed', 'acknowledged', 'food_ready', 'dispatched', 'completed']
        order_count_data = {}
        for provider in ['Zomato', 'Swiggy']:
            order_counts = {
                status: self.env['pos.order'].search_count([
                    ('delivery_status', '=', status),
                    ('delivery_channel', '=', provider),
                    ('session_id', '=', session_id),
                    ('state', '!=', 'cancel')
                ]) for status in order_statuses
            }
            order_count_data[provider] = {
                'awaiting': order_counts['placed'],
                'preparing': order_counts['acknowledged'],
                'done': order_counts['food_ready'] + order_counts['dispatched'] + order_counts['completed']
            }
        return {'urbanpiper': order_count_data}

    def _get_active_delivery_providers(self):
        """
        Fetch delivery providers for pos ui
        """
        providers = ['Zomato', 'Swiggy']
        urbanpiper_providers = []
        for provider in providers:
            urbanpiper_providers.append({
                'code': provider,
                'name': provider,
                'image': f'/pos_urban_piper/static/img/{provider}.svg',
                'id': providers.index(provider) + 1
            })
        return urbanpiper_providers

    def _urbanpiper_handle_response(self, response_json, raise_exception=False):
        """
        Handle response from urban piper
        """
        if response_json.get('message'):
            msg_type = ''
            if response_json.get('status') == 'success':
                msg_type = 'success'
            elif response_json.get('status') == 'error':
                if raise_exception:
                    raise ValidationError(response_json['message'])
                else:
                    msg_type = 'danger'
            message = response_json['message']
            if msg_type == 'success':
                message = message.split('.')[0]
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('Urban Piper'),
                    'message': message,
                    'type': msg_type,
                    'sticky': False,
                    'next': {'type': 'ir.actions.act_window_close'},  # force a form reload
                }
            }

    def _check_required_request_params(self, store_required=True):
        msg = ''
        user_name = self.env['ir.config_parameter'].sudo().get_param('pos_urban_piper.urbanpiper_username', False)
        api_key = self.env['ir.config_parameter'].sudo().get_param('pos_urban_piper.urbanpiper_apikey', False)
        if not user_name:
            msg += _('Urban Piper Username is required.\n')
        if not api_key:
            msg += _('Urban Piper API Key is required.\n')
        if not self.urbanpiper_store_identifier and store_required:
            msg += _('Urban Piper Store ID is required.\n')
        if msg:
            raise UserError(msg)

    def log_xml(self, xml_string, func):
        self.env.flush_all()
        db_name = self.env.cr.dbname

        try:
            db_registry = registry(db_name)
            with db_registry.cursor() as cr:
                env = api.Environment(cr, SUPERUSER_ID, {})
                IrLogging = env['ir.logging']
                IrLogging.sudo().create({'name': 'Urban piper error handler',
                            'type': 'server',
                            'dbname': db_name,
                            'level': 'DEBUG',
                            'message': xml_string,
                            'path': 'Urbanpiper',
                            'func': func,
                            'line': 1})
        except psycopg2.Error:
            pass
