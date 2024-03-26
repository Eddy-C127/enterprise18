# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class PosSession(models.Model):
    _inherit = 'pos.session'

    def _load_data_params(self, config_id):
        params = super()._load_data_params(config_id)

        params['pos.payment.method']['fields'] += ['iot_device_id']
        params['pos.printer']['fields'] += ['device_identifier']
        params['iot.device'] = {
            'domain': [('id', 'in', self.config_id.iot_device_ids.ids + [payment.iot_device_id.id for payment in self.config_id.payment_method_ids if payment.iot_device_id])],
            'fields': ['iot_ip', 'iot_id', 'identifier', 'type', 'manual_measurement'],
        }
        params['iot.box'] = {
            'domain': lambda data: [('id', 'in', [device['iot_id'] for device in data['iot.device'] if device['iot_id']])],
            'fields': ['ip', 'ip_url', 'name'],
        }

        return params
