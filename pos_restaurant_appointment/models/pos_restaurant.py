# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from collections import defaultdict
from odoo import api, fields, models
from datetime import timedelta

class RestaurantTable(models.Model):
    _inherit = 'restaurant.table'

    appointment_resource_id = fields.Many2one('appointment.resource', string='Appointment resource')

    @api.model_create_multi
    def create(self, vals_list):
        tables = super().create(vals_list)

        for table in tables:
            if not table.appointment_resource_id:
                table.appointment_resource_id = table.env['appointment.resource'].sudo().create({
                    'name': f'{table.floor_id.name} - {table.name}',
                    'capacity': table.seats,
                    'pos_table_ids': table,
                })

        return tables

    def write(self, vals):
        table = super().write(vals)

        if not self.active:
            self.appointment_resource_id.sudo().active = False
        else:
            if self.appointment_resource_id:
                self.appointment_resource_id.sudo().write({
                    'name': f'{self.floor_id.name} - {self.name}',
                    'capacity': self.seats,
                })

        return table

    def unlink(self):
        for table in self:
            table.appointment_resource_id.sudo().unlink()

        return super().unlink()

    @api.ondelete(at_uninstall=True)
    def _delete_linked_resources(self):
        for table in self:
            table.appointment_resource_id.unlink()
