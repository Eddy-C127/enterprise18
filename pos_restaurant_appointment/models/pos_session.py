# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields
from datetime import timedelta

class PosSession(models.Model):
    _inherit = 'pos.session'

    def _load_data_params(self, config_id):
        params = super()._load_data_params(config_id)
        now = fields.Datetime.now()
        dayAfter = fields.Date.today() + timedelta(days=1)

        if self.config_id.module_pos_restaurant:
            params['restaurant.table']['fields'].append('appointment_resource_id')
            params['appointment.resource'] = {
                'fields': ['pos_table_ids'],
                'domain': lambda data: [('pos_table_ids', 'in', [table['id'] for table in data['restaurant.table']])],
            }
            params['calendar.event'] = {
                'domain': lambda data: [
                    ('booking_line_ids.appointment_resource_id', 'in', [table['appointment_resource_id'] for table in data['restaurant.table']]),
                    ('appointment_type_id', 'in', sum([config['appointment_type_ids'] for config in data['pos.config']], [])),
                    '|', '&', ('start', '>=', now), ('start', '<=', dayAfter), '&', ('stop', '>=', now), ('stop', '<=', dayAfter),
                ],
                'fields': self.env['calendar.event']._fields_for_restaurant_table(),
            }

        return params
