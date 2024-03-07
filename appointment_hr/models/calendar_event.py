# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models
from odoo.addons.appointment.utils import interval_from_events, intervals_overlap
from odoo.addons.resource.models.utils import Intervals, timezone_datetime


class CalendarEvent(models.Model):
    _inherit = "calendar.event"

    @api.depends('start', 'stop', 'partner_ids')
    def _compute_on_leave_partner_ids(self):
        super()._compute_on_leave_partner_ids()

        user_events = self.filtered(
            lambda event:
                event.appointment_type_id.schedule_based_on == 'users' and
                event.partner_ids.filtered('user_ids') > event.on_leave_partner_ids
        )
        if not user_events:
            return

        calendar_ids = user_events.partner_ids.user_ids.employee_ids.resource_calendar_id
        calendar_to_employees = user_events.partner_ids.user_ids.employee_ids.grouped('resource_calendar_id')

        for start, stop, events in interval_from_events(user_events):
            group_calendars = calendar_ids.filtered(lambda calendar: calendar in events.partner_ids.user_ids.employee_ids.resource_calendar_id)
            calendar_to_unavailabilities = {
                calendar: calendar._unavailable_intervals_batch(
                    timezone_datetime(start), timezone_datetime(stop), calendar_to_employees[calendar].resource_id
                ) for calendar in group_calendars
            }
            for event in events:
                # avoid some work for partners already on the list
                partner_employees = (event.partner_ids - event.on_leave_partner_ids).user_ids.employee_ids
                for employee in partner_employees:
                    if not employee.resource_calendar_id or not employee.resource_id:
                        continue
                    unavailabilities = calendar_to_unavailabilities.get(employee.resource_calendar_id, {}).get(employee.resource_id.id, [])
                    if any(intervals_overlap(unavailability, (event.start, event.stop)) for unavailability in unavailabilities):
                        event.on_leave_partner_ids += employee.user_partner_id

    @api.model
    def gantt_unavailability(self, start_date, end_date, scale, group_bys=None, rows=None):
        # skip if not dealing with appointments
        partner_ids = [row['resId'] for row in rows if row.get('resId')]  # remove empty rows
        if not group_bys or group_bys[0] != 'partner_ids' or not partner_ids:
            return super().gantt_unavailability(start_date, end_date, scale, group_bys=group_bys, rows=rows)

        start_datetime = timezone_datetime(fields.Datetime.from_string(start_date))
        end_datetime = timezone_datetime(fields.Datetime.from_string(end_date))

        partners = self.env['res.partner'].browse(partner_ids)
        users = partners.user_ids
        users_from_partner_id = users.grouped(lambda user: user.partner_id.id)

        calendars = users.employee_id.resource_calendar_id
        employee_by_calendar = users.employee_id.grouped('resource_calendar_id')
        unavailabilities_by_calendar = {
            calendar: calendar._unavailable_intervals_batch(
                start_datetime, end_datetime,
                resources=employee_by_calendar[calendar].resource_id
            ) for calendar in calendars
        }

        event_unavailabilities = self._gantt_unavailabilities_events(start_datetime, end_datetime, partners)
        for row in rows:
            attendee_users = users_from_partner_id.get(row['resId'], self.env['res.users'])
            attendee = partners.filtered(lambda partner: partner.id == row['resId'])

            # calendar leaves
            unavailabilities = event_unavailabilities.get(attendee.id, Intervals([]))
            for user in attendee_users.filtered('employee_resource_calendar_id'):
                calendar_leaves = unavailabilities_by_calendar[user.employee_resource_calendar_id]
                unavailabilities |= Intervals([
                    (start, end, attendee)
                    for start, end in calendar_leaves.get(user.employee_id.resource_id.id, [])])
            row['unavailabilities'] = [{'start': start, 'stop': stop} for start, stop, _ in unavailabilities]
        return rows
