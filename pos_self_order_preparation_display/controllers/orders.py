# -*- coding: utf-8 -*-

from odoo import http
from odoo.addons.pos_self_order.controllers.orders import PosSelfOrderController

class PosSelfOrderPreparationDisplayController(PosSelfOrderController):
    @http.route()
    def process_new_order(self, order, access_token, table_identifier, device_type):
        res = super().process_new_order(order, access_token, table_identifier, device_type)
        self._send_to_preparation_display(order, access_token, table_identifier, res['id'])
        return res

    @http.route()
    def update_existing_order(self, order, access_token, table_identifier):
        res = super().update_existing_order(order, access_token, table_identifier)
        self._send_to_preparation_display(order, access_token, table_identifier, res['id'])
        return res

    @http.route()
    def change_printer_status(self, access_token, has_paper):
        super().change_printer_status(access_token, has_paper)
        pos_config = self._verify_pos_config(access_token)
        pos_config.env['pos_preparation_display.display']._paper_status_change(pos_config)

    def _send_to_preparation_display(self, order, access_token, table_identifier, order_id):
        pos_config, _ = self._verify_authorization(access_token, table_identifier, order.get('takeaway'))
        order_id = pos_config.env['pos.order'].browse(order_id)
        payment_methods = self._get_self_payment_methods(pos_config)
        if pos_config.self_ordering_pay_after == 'each' and len(payment_methods) == 0:
            pos_config.env['pos_preparation_display.order'].process_order(order_id.id)

        if order_id.table_id:
            order_id.send_table_count_notification(order_id.table_id)

    def _get_self_payment_methods(self, pos_config):
        return pos_config._get_allowed_payment_methods()
