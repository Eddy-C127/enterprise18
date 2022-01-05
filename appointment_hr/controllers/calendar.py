# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _
from odoo.addons.appointment.controllers.calendar import AppointmentController
from odoo.exceptions import AccessError
from odoo.http import request, route


class AppointmentHrController(AppointmentController):

    @route('/appointment/calendar_appointment_type/search_create_work_hours', type='json', auth='user')
    def appointment_search_create_work_hours_appointment_type(self):
        """
        Return the info (id and url) of the work hours appointment type of the actual staff member.

        Search and return the work_hours appointment type for the staff member.
        In case it doesn't exist yet, it creates a work_hours appointment type that
        uses a slot of 1 hour every 30 minutes during it's working hour.
        We emcopass the whole week to avoid computation in case the working hours
        of the staff member are modified at a later date.
        """
        appointment_type = request.env['calendar.appointment.type'].search([
            ('category', '=', 'work_hours'),
            ('staff_user_ids', 'in', request.env.user.ids)])
        if not appointment_type:
            # Check if the user is a member of group_user to avoid portal user and the like to create appointment types
            if not request.env.user.user_has_groups('base.group_user'):
                raise AccessError(_("Access Denied"))
            appointment_type = request.env['calendar.appointment.type'].sudo().create({
                'max_schedule_days': 30,
                'category': 'work_hours',
                'slot_ids': [(0, 0, {
                    'weekday': str(day + 1),
                    'start_hour': hour * 0.5,
                    'end_hour': 23.99,
                }) for hour in range(2) for day in range(7)],
            })

        return self._get_staff_user_appointment_info(appointment_type)

    @route('/appointment/calendar_appointment_type/get_staff_user_appointment_types', type='json', auth='user')
    def appointment_get_staff_user_appointment_types(self):
        res = super().appointment_get_staff_user_appointment_types()
        res['context_user_has_employee'] = bool(request.env.user.employee_id)
        return res
