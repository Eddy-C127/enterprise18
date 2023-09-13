# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licens

from odoo import _
from odoo.addons.planning.controllers.main import ShiftController
from odoo.http import request
from odoo.tools import format_duration, format_amount


class ShiftControllerProject(ShiftController):

    def _planning_get(self, planning_token, employee_token, message=False):
        result = super()._planning_get(planning_token, employee_token, message)
        if not result:
            # one of the token does not match an employee/planning
            return
        employee_fullcalendar_data = result['employee_slots_fullcalendar_data']
        new_employee_fullcalendar_data = []
        mapped_data = {
            slot_data['slot_id']: slot_data
            for slot_data in employee_fullcalendar_data
        }
        slot_ids = request.env['planning.slot'].sudo().browse(list(mapped_data.keys()))
        for slot_sudo in slot_ids:
            slot_data = mapped_data[slot_sudo.id]
            if slot_sudo.sale_line_id:
                remaining_hours = slot_sudo.sale_line_id.planning_hours_to_plan - slot_sudo.sale_line_id.planning_hours_planned
                remaining_str = f'({format_duration(remaining_hours)} remaining)' if remaining_hours != 0 else ''
                sols_list = slot_sudo.sale_line_id.order_id.order_line
                price_unit = f'({format_amount(request.env, slot_sudo.sale_line_id.price_unit, slot_sudo.sale_line_id.currency_id)})' if len(sols_list) > 1 and len(sols_list.product_id) == 1 else ''
                slot_data['sale_line'] = f'{slot_sudo.sale_line_id.display_name} {price_unit} {remaining_str}'
            # Reset the title according to the project and task name
            vals = self._prepare_slot_vals(slot_sudo, employee_token)
            slot_data['title'] = vals['title']
            new_employee_fullcalendar_data.append(slot_data)
        result['employee_slots_fullcalendar_data'] = new_employee_fullcalendar_data
        open_slots = result['open_slots_ids']
        unwanted_slots = result['unwanted_slots_ids']
        result['open_slot_has_sale_line'] = any(s.sale_line_id for s in open_slots)
        result['unwanted_slot_has_sale_line'] = any(s.sale_line_id for s in unwanted_slots)
        return result

    def _prepare_slot_vals(self, slot, employee_token):
        result = super()._prepare_slot_vals(slot, employee_token)
        if slot.sale_line_id:
            remaining_hours = slot.sale_line_id.planning_hours_to_plan - slot.sale_line_id.planning_hours_planned
            remaining_str = f'({format_duration(remaining_hours)} remaining)' if remaining_hours != 0 else ''
            sols_list = slot.sale_line_id.order_id.order_line
            price_unit = f'({format_amount(request.env, slot.sale_line_id.price_unit, slot.sale_line_id.currency_id)})' if len(sols_list) > 1 and len(sols_list.product_id) == 1 else ''
            result['title'] = " - ".join(x for x in (result['title'], f'{slot.sale_line_id.display_name} {price_unit} {remaining_str}') if x)
        return result
