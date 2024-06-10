import logging

from odoo import _, api, fields, models
from odoo.tools import convert

_logger = logging.getLogger(__name__)


class PosConfig(models.Model):
    _inherit = 'pos.config'

    available_iot_box_ids = fields.One2many(
        'iot.box',
        'pos_id',
        string='Available IoT Boxes',
        domain="[('can_be_kiosk', '=', True)]",
        required=True,
    )

    def _get_kitchen_printer(self):
        res = super()._get_kitchen_printer()
        for printer in self.printer_ids:
            if printer.device_identifier:
                res[printer.id]["device_identifier"] = printer.device_identifier
        return res

    def get_available_iot_box_ids(self):
        self.available_iot_box_ids = self.env['iot.box'].search([('can_be_kiosk', '=', True)])
        return self.available_iot_box_ids.read(['id', 'name', 'ip'])

    @api.model
    def _load_restaurant_data(self):
        convert.convert_file(
            self.env,
            'pos_restaurant',
            'data/scenarios/restaurant_data.xml',
            None,
            noupdate=True,
            mode='init',
            kind='data'
        )

    @api.model
    def load_onboarding_restaurant_scenario(self):
        ref_name = 'pos_restaurant.pos_config_main_restaurant'
        if not self.env.ref(ref_name, raise_if_not_found=False):
            self._load_restaurant_data()

        journal, payment_methods_ids = self._create_journal_and_payment_methods()
        restaurant_categories = [
            self.env.ref('pos_restaurant.food').id,
            self.env.ref('pos_restaurant.drinks').id,
        ]
        not_cash_payment_methods_ids = self.env['pos.payment.method'].search([
            ('is_cash_count', '=', False),
            ('id', 'in', payment_methods_ids),
        ]).ids
        config = self.env['pos.config'].create({
            'name': _('Kiosk'),
            'company_id': self.env.company.id,
            'journal_id': journal.id,
            'payment_method_ids': not_cash_payment_methods_ids,
            'limit_categories': True,
            'iface_available_categ_ids': restaurant_categories,
            'iface_splitbill': True,
            'module_pos_restaurant': True,
        })
        config.write({'self_ordering_mode': 'kiosk'})
        self.env['ir.model.data']._update_xmlids([{
            'xml_id': self._get_suffixed_ref_name(ref_name),
            'record': config,
            'noupdate': True,
        }])
