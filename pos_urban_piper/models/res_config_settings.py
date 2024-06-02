from odoo import fields, models

from .pos_urban_piper_request import UrbanPiperClient


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    urbanpiper_username = fields.Char(
        string='Username',
        config_parameter='pos_urban_piper.urbanpiper_username',
        help='The username for the UrbanPiper account.'
    )
    urbanpiper_apikey = fields.Char(
        string='UrbanPiper API Key',
        config_parameter='pos_urban_piper.urbanpiper_apikey',
        help='The API key for accessing the UrbanPiper services.'
    )
    pos_urbanpiper_store_identifier = fields.Char(
        string='UrbanPiper Store Identifier',
        related='pos_config_id.urbanpiper_store_identifier',
        readonly=False,
        help='The POS ID associated with UrbanPiper.'
    )
    pos_urbanpiper_pricelist_id = fields.Many2one(
        'product.pricelist',
        related='pos_config_id.urbanpiper_pricelist_id',
        string='UrbanPiper Pricelist',
        help='The pricelist used for UrbanPiper orders.'
    )
    pos_urbanpiper_fiscal_position_id = fields.Many2one(
        'account.fiscal.position',
        related='pos_config_id.urbanpiper_fiscal_position_id',
        string='UrbanPiper Fiscal Position',
        help='The fiscal position used for UrbanPiper transactions.'
    )
    pos_urbanpiper_payment_methods_ids = fields.Many2many(
        'pos.payment.method',
        related='pos_config_id.urbanpiper_payment_methods_ids',
        string='Online Delivery Payment Methods',
        domain="[('is_delivery_payment', '=', True)]",
        help='The payment methods used for online delivery through UrbanPiper.'
    )
    pos_urbanpiper_last_sync_date = fields.Datetime(
        string='Last Sync on',
        related='pos_config_id.urbanpiper_last_sync_date',
        help='The date and time of the last synchronization with UrbanPiper.'
    )
    pos_urbanpiper_webhook_url = fields.Char(
        string='Urban Piper Webhook URL',
        related='pos_config_id.urbanpiper_webhook_url',
        help='Register webhook with Urbanpiper.',
        readonly=False
    )

    def urbanpiper_sync_menu(self):
        """
        Sync the menu with UrbanPiper. This will update the menu items and categories in UrbanPiper.
        """
        self.pos_config_id._check_required_request_params()
        up = UrbanPiperClient(self.pos_config_id)
        up.configure_webhook()
        response_json = up.request_sync_menu()
        return self.pos_config_id._urbanpiper_handle_response(response_json)

    def action_refresh_webhooks(self):
        self.pos_config_id._check_required_request_params()
        up = UrbanPiperClient(self.pos_config_id)
        response_json = up.request_refresh_webhooks()
        return self.pos_config_id._urbanpiper_handle_response(response_json)
