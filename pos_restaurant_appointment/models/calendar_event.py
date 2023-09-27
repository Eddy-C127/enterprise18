# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict
from odoo import api, models, fields


class CalendarEvent(models.Model):
    _inherit = "calendar.event"

    @api.model
    def _fields_for_restaurant_table(self):
        return [
            'id',
            'start',
            'duration',
            'stop',
            'name',
            'appointment_type_id',
            'appointment_resource_ids',
            'resource_total_capacity_reserved',
        ]

    @api.model
    def _send_table_notifications(self, events, command):
        today = fields.Date.today()
        fields_to_read = self._fields_for_restaurant_table()
        event_list = []

        for event in events:
            event_dict = event.read(fields_to_read, load=False)[0]
            # tables that are booked for this event
            event_table_ids = event.booking_line_ids.appointment_resource_id.sudo().pos_table_ids
            for table in event_table_ids:
                for config in table.floor_id.pos_config_ids:
                    session = config.current_session_id

                    # Don't include the event if it's not for today
                    if not session or event.start.date() != today:
                        continue

                    event_list.append({
                        'session': session,
                        'event': event_dict,
                    })

        for item in event_list:
            session.config_id._notify(("TABLE_BOOKING", {
                "command": command,
                "event": item['event'],
            }))

    @api.model_create_multi
    def create(self, vals_list):
        new_events = super().create(vals_list)
        self._send_table_notifications(new_events, "ADDED")
        return new_events

    def write(self, vals):
        result = super().write(vals)
        self._send_table_notifications(self, "ADDED")
        return result

    def unlink(self):
        self._send_table_notifications(self, "REMOVED")
        return super().unlink()
