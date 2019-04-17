# # -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from dateutil.relativedelta import relativedelta
import pytz

from odoo.fields import Datetime, Date
from odoo.tests.common import tagged
from odoo.addons.hr_payroll.tests.common import TestPayslipBase


@tagged('work_entry')
class TestWorkEntry(TestPayslipBase):
    def setUp(self):
        super(TestWorkEntry, self).setUp()
        self.tz = pytz.timezone(self.richard_emp.tz)
        self.start = datetime(2015, 11, 1, 1, 0, 0)
        self.end = datetime(2015, 11, 30, 23, 59, 59)
        self.resource_calendar_id = self.env['resource.calendar'].create({'name': 'Zboub'})
        contract = self.env['hr.contract'].create({
            'date_start': self.start.date() - relativedelta(days=5),
            'name': 'dodo',
            'resource_calendar_id': self.resource_calendar_id.id,
            'wage': 1000,
            'employee_id': self.richard_emp.id,
            'structure_type_id': self.structure_type.id,
            'state': 'open',
        })
        self.richard_emp.resource_calendar_id = self.resource_calendar_id
        self.richard_emp.contract_id = contract

    def test_no_duplicate(self):
        self.richard_emp.generate_work_entry(self.start, self.end)
        pou1 = self.env['hr.work.entry'].search_count([])
        self.richard_emp.generate_work_entry(self.start, self.end)
        pou2 = self.env['hr.work.entry'].search_count([])
        self.assertEqual(pou1, pou2, "Work entries should not be duplicated")

    def test_work_entry(self):
        self.richard_emp.generate_work_entry(self.start, self.end)
        attendance_nb = len(self.resource_calendar_id._attendance_intervals(self.start.replace(tzinfo=pytz.utc), self.end.replace(tzinfo=pytz.utc)))
        work_entry_nb = self.env['hr.work.entry'].search_count([('employee_id', '=', self.richard_emp.id)])
        self.assertEqual(attendance_nb, work_entry_nb, "One work_entry should be generated for each calendar attendance")

    def test_split_work_entry_by_day(self):
        start = datetime(2015, 11, 1, 9, 0, 0)
        end = datetime(2015, 11, 3, 18, 0, 0)

        # Work entry of type attendance should be split in three
        work_entry = self.env['hr.work.entry'].create({
            'name': '1',
            'employee_id': self.richard_emp.id,
            'contract_id': self.richard_emp.contract_id.id,
            'date_start': start,
            'date_stop': end,
        })

        work_entries = work_entry._split_by_day()
        self.assertEqual(len(work_entries), 3, "Work entry should be split in three")

        self.assertEqual(work_entries[0].date_start, datetime(2015, 11, 1, 9, 0, 0))
        self.assertEqual(work_entries[0].date_stop, datetime(2015, 11, 1, 23, 59, 59))

        self.assertEqual(work_entries[1].date_start, datetime(2015, 11, 2, 0, 0, 0))
        self.assertEqual(work_entries[1].date_stop, datetime(2015, 11, 2, 23, 59, 59))

        self.assertEqual(work_entries[2].date_start, datetime(2015, 11, 3, 0, 0, 0))
        self.assertEqual(work_entries[2].date_stop, datetime(2015, 11, 3, 18, 0, 0))

        # Test with end at mid-night -> should not create work_entry starting and ending at the same time (at 00:00)
        start = datetime(2013, 11, 1, 0, 0, 0)
        end = datetime(2013, 11, 4, 0, 0, 0)

        work_entry = self.env['hr.work.entry'].create({
            'name': '1',
            'employee_id': self.richard_emp.id,
            'contract_id': self.richard_emp.contract_id.id,
            'date_start': start,
            'date_stop': end,
        })
        work_entries = work_entry._split_by_day()
        self.assertEqual(len(work_entries), 3, "Work entry should be split in three")
        self.assertEqual(work_entries[0].date_start, datetime(2013, 11, 1, 0, 0, 0))
        self.assertEqual(work_entries[0].date_stop, datetime(2013, 11, 1, 23, 59, 59))

        self.assertEqual(work_entries[1].date_start, datetime(2013, 11, 2, 0, 0, 0))
        self.assertEqual(work_entries[1].date_stop, datetime(2013, 11, 2, 23, 59, 59))

        self.assertEqual(work_entries[2].date_start, datetime(2013, 11, 3, 0, 0, 0))
        self.assertEqual(work_entries[2].date_stop, datetime(2013, 11, 3, 23, 59, 59))

    def test_approve_multiple_day_work_entry(self):
        start = datetime(2015, 11, 1, 9, 0, 0)
        end = datetime(2015, 11, 3, 18, 0, 0)

        # Work entry of type attendance should be split in three
        work_entry = self.env['hr.work.entry'].create({
            'name': '1',
            'employee_id': self.richard_emp.id,
            'contract_id': self.richard_emp.contract_id.id,
            'date_start': start,
            'date_stop': end,
            'work_entry_type_id': self.work_entry_type.id,
        })
        work_entry.action_validate()
        work_entries = self.env['hr.work.entry'].search([('employee_id', '=', self.richard_emp.id)])
        self.assertTrue(all((b.state == 'validated' for b in work_entries)), "Work entries should be approved")
        self.assertEqual(len(work_entries), 3, "Work entry should be split in three")

    def test_duplicate_global_work_entry_to_attendance(self):
        start = datetime(2015, 11, 1, 9, 0, 0)
        end = datetime(2015, 11, 3, 18, 0, 0)

        work_entry = self.env['hr.work.entry'].create({
            'name': '1',
            'employee_id': self.richard_emp.id,
            'work_entry_type_id': self.env.ref('hr_payroll.work_entry_type_attendance').id,
            'contract_id': self.richard_emp.contract_id.id,
            'date_start': start,
            'date_stop': end,
        })
        work_entry._duplicate_to_calendar()
        attendance_nb = self.env['resource.calendar.attendance'].search_count([
            ('date_from', '>=', start.date()),
            ('date_to', '<=', end.date())
        ])
        self.assertEqual(attendance_nb, 0, "It should not duplicate the 'normal/global' work_entry type")

    def test_duplicate_work_entry_to_attendance(self):
        start = datetime(2015, 11, 1, 9, 0, 0)
        end = datetime(2015, 11, 3, 18, 0, 0)

        # Work entry (not leave) should be split in three attendance
        work_entry = self.env['hr.work.entry'].create({
            'name': '1',
            'employee_id': self.richard_emp.id,
            'work_entry_type_id': self.work_entry_type.id,
            'contract_id': self.richard_emp.contract_id.id,
            'date_start': start,
            'date_stop': end,
        })
        work_entry._duplicate_to_calendar()
        attendance_nb = self.env['resource.calendar.attendance'].search_count([
            ('date_from', '>=', start.date()),
            ('date_to', '<=', end.date())
        ])
        self.assertEqual(attendance_nb, 3, "It should create one calendar attendance per day")
        self.assertTrue(self.env['resource.calendar.attendance'].search([
            ('date_from', '=', Date.to_date('2015-11-01')),
            ('date_to', '=', Date.to_date('2015-11-01')),
            ('hour_from', '=', 9.0),
            ('hour_to', '>=', 23.9)
        ]))
        self.assertTrue(self.env['resource.calendar.attendance'].search([
            ('date_from', '=', Date.to_date('2015-11-02')),
            ('date_to', '=', Date.to_date('2015-11-02')),
            ('hour_from', '=', 0.0),
            ('hour_to', '>=', 23.9)
        ]))
        self.assertTrue(self.env['resource.calendar.attendance'].search([
            ('date_from', '=', Date.to_date('2015-11-03')),
            ('date_to', '=', Date.to_date('2015-11-03')),
            ('hour_from', '=', 0.0),
            ('hour_to', '=', 18.0)
        ]))

    def test_create_work_entry_leave(self):
        start = datetime(2015, 11, 1, 9, 0, 0)
        end = datetime(2015, 11, 3, 18, 0, 0)

        work_entry = self.env['hr.work.entry'].create({
            'name': 'Richard leave from work_entry',
            'employee_id': self.richard_emp.id,
            'work_entry_type_id': self.work_entry_type_leave.id,
            'contract_id': self.richard_emp.contract_id.id,
            'date_start': start,
            'date_stop': end,
        })
        work_entry.action_validate()
        calendar_leave = self.env['resource.calendar.leaves'].search([('name', '=', 'Richard leave from work_entry')])
        self.assertTrue(calendar_leave, "It should have created a leave in the calendar")
        self.assertEqual(calendar_leave.work_entry_type_id, work_entry.work_entry_type_id, "It should have the same work_entry type")

    def test_validate_conflict_work_entry(self):
        start = datetime(2015, 11, 1, 9, 0, 0)
        end = datetime(2015, 11, 1, 13, 0, 0)
        work_entry1 = self.env['hr.work.entry'].create({
            'name': '1',
            'employee_id': self.richard_emp.id,
            'work_entry_type_id': self.env.ref('hr_payroll.work_entry_type_attendance').id,
            'contract_id': self.richard_emp.contract_id.id,
            'date_start': start,
            'date_stop': end + relativedelta(hours=5),
        })
        self.env['hr.work.entry'].create({
            'name': '2',
            'employee_id': self.richard_emp.id,
            'work_entry_type_id': self.env.ref('hr_payroll.work_entry_type_attendance').id,
            'contract_id': self.richard_emp.contract_id.id,
            'date_start': start + relativedelta(hours=3),
            'date_stop': end,
        })
        self.assertFalse(work_entry1.action_validate(), "It should not validate work_entries conflicting with others")
        self.assertTrue(work_entry1.display_warning)
        self.assertNotEqual(work_entry1.state, 'validated')

    def test_validate_non_approved_leave_work_entry(self):
        work_entry1 = self.env['hr.work.entry'].create({
            'name': '1',
            'employee_id': self.richard_emp.id,
            'work_entry_type_id': self.work_entry_type_leave.id,
            'contract_id': self.richard_emp.contract_id.id,
            'date_start': self.start,
            'date_stop': self.end,
        })
        self.env['hr.leave'].create({
            'name': 'Doctor Appointment',
            'employee_id': self.richard_emp.id,
            'holiday_status_id': self.leave_type.id,
            'date_from': self.start - relativedelta(days=1),
            'date_to': self.start + relativedelta(days=1),
            'number_of_days': 2,
        })
        self.assertFalse(work_entry1.action_validate(),"It should not validate work_entries conflicting with non approved leaves")
        self.assertTrue(work_entry1.display_warning)

    def test_validate_undefined_work_entry(self):
        work_entry1 = self.env['hr.work.entry'].create({
            'name': '1',
            'employee_id': self.richard_emp.id,
            'contract_id': self.richard_emp.contract_id.id,
            'date_start': self.start,
            'date_stop': self.end,
        })
        self.assertFalse(work_entry1.action_validate(),"It should not validate work_entries without a type")

    def test_approve_leave_work_entry(self):
        start = datetime(2015, 11, 1, 9, 0, 0)
        end = datetime(2015, 11, 3, 13, 0, 0)
        leave = self.env['hr.leave'].create({
            'name': 'Doctor Appointment',
            'employee_id': self.richard_emp.id,
            'holiday_status_id': self.leave_type.id,
            'date_from': start,
            'date_to': start + relativedelta(days=1),
            'number_of_days': 2,
        })
        self.env['hr.work.entry'].create({
            'name': '1',
            'employee_id': self.richard_emp.id,
            'contract_id': self.richard_emp.contract_id.id,
            'work_entry_type_id': self.work_entry_type.id,
            'date_start': start,
            'date_stop': end,
            'leave_id': leave.id, # work_entry conflicts with this leave
        })
        leave.action_approve()

        new_leave_work_entries = self.env['hr.work.entry'].search([
            ('date_start', '=', Datetime.to_datetime(datetime(2015, 11, 1, 9, 0, 0))),
            ('date_stop', '=', Datetime.to_datetime(datetime(2015, 11, 2, 9, 0, 0))),
            ('work_entry_type_id.is_leave', '=', True)
        ])

        new_work_entries = self.env['hr.work.entry'].search([
            ('date_start', '=', Datetime.to_datetime(datetime(2015, 11, 2, 9, 0, 1))),
            ('date_stop', '=', end),
            ('work_entry_type_id.is_leave', '=', False)
        ])

        self.assertTrue(new_work_entries, "It should have created a work_entry for the last two days")
        self.assertTrue(new_leave_work_entries, "It should have created a leave work_entry for the first day")

        self.assertTrue((new_work_entries | new_leave_work_entries).action_validate(), "It should be able to validate the work_entries")

    def test_refuse_leave_work_entry(self):
        start = datetime(2015, 11, 1, 9, 0, 0)
        end = datetime(2015, 11, 3, 13, 0, 0)
        leave = self.env['hr.leave'].create({
            'name': 'Doctor Appointment',
            'employee_id': self.richard_emp.id,
            'holiday_status_id': self.leave_type.id,
            'date_from': start,
            'date_to': start + relativedelta(days=1),
            'number_of_days': 2,
        })
        work_entry = self.env['hr.work.entry'].create({
            'name': '1',
            'employee_id': self.richard_emp.id,
            'contract_id': self.richard_emp.contract_id.id,
            'work_entry_type_id': self.work_entry_type.id,
            'date_start': start,
            'date_stop': end,
            'leave_id': leave.id
        })
        work_entry.action_validate()
        self.assertTrue(work_entry.display_warning, "It should have an error (conflicting leave to approve")
        leave.action_refuse()
        self.assertFalse(work_entry.display_warning, "It should not have an error")

    def test_time_normal_work_entry(self):
        # Normal attendances (global to all employees)
        data = self.richard_emp._get_work_entry_days_data(self.env.ref('hr_payroll.work_entry_type_attendance'), self.start, self.end)
        self.assertEqual(data['hours'], 168.0)

    def test_time_extra_work_entry(self):
        start = datetime(2015, 11, 1, 10, 0, 0)
        end = datetime(2015, 11, 1, 17, 0, 0)
        work_entry = self.env['hr.work.entry'].create({
            'name': '1',
            'employee_id': self.richard_emp.id,
            'contract_id': self.richard_emp.contract_id.id,
            'work_entry_type_id': self.work_entry_type.id,
            'date_start': start,
            'date_stop': end,
        })
        work_entry.action_validate()
        data = self.richard_emp._get_work_entry_days_data(self.work_entry_type, self.start, self.end)
        self.assertEqual(data['hours'], 7.0)

    def test_time_week_leave_work_entry(self):
        # /!\ this is a week day => it exists an calendar attendance at this time
        start = datetime(2015, 11, 2, 10, 0, 0)
        end = datetime(2015, 11, 2, 17, 0, 0)
        leave_work_entry = self.env['hr.work.entry'].create({
            'name': '1leave',
            'employee_id': self.richard_emp.id,
            'contract_id': self.richard_emp.contract_id.id,
            'work_entry_type_id': self.work_entry_type_leave.id,
            'date_start': start,
            'date_stop': end,
        })
        leave_work_entry.action_validate()
        data = self.richard_emp._get_work_entry_days_data(self.work_entry_type_leave, self.start, self.end)
        self.assertEqual(data['hours'], 5.0, "It should equal the number of hours richard should have worked")

    def test_time_weekend_leave_work_entry(self):
        # /!\ this is in the weekend => no calendar attendance at this time
        start = datetime(2015, 11, 1, 10, 0, 0)
        end = datetime(2015, 11, 1, 17, 0, 0)
        leave_work_entry = self.env['hr.work.entry'].create({
            'name': '1leave',
            'employee_id': self.richard_emp.id,
            'contract_id': self.richard_emp.contract_id.id,
            'work_entry_type_id': self.work_entry_type_leave.id,
            'date_start': start,
            'date_stop': end,
        })
        leave_work_entry.action_validate()
        data = self.richard_emp._get_work_entry_days_data(self.work_entry_type_leave, self.start, self.end)
        self.assertEqual(data['hours'], 0.0, "It should equal the number of hours richard should have worked")

    def test_payslip_generation_with_leave(self):
        # /!\ this is a week day => it exists an calendar attendance at this time
        start = datetime(2015, 11, 2, 10, 0, 0)
        end = datetime(2015, 11, 2, 17, 0, 0)
        leave_work_entry = self.env['hr.work.entry'].create({
            'name': '1leave',
            'employee_id': self.richard_emp.id,
            'contract_id': self.richard_emp.contract_id.id,
            'work_entry_type_id': self.work_entry_type_leave.id,
            'date_start': start,
            'date_stop': end,
        })
        leave_work_entry.action_validate()
        payslip_wizard = self.env['hr.payslip.employees'].create({'employee_ids': [(4, self.richard_emp.id)]})
        payslip_wizard.with_context({'default_date_start': Date.to_string(start), 'default_date_end': Date.to_string(end)}).compute_sheet()
        payslip = self.env['hr.payslip'].search([('employee_id', '=', self.richard_emp.id)])
        work_line = payslip.worked_days_line_ids.filtered(lambda l: l.work_entry_type_id == self.env.ref('hr_payroll.work_entry_type_attendance'))  # From default calendar.attendance
        leave_line = payslip.worked_days_line_ids.filtered(lambda l: l.work_entry_type_id == self.work_entry_type_leave)

        self.assertTrue(work_line, "It should have a work line in the payslip")
        self.assertTrue(leave_line, "It should have a leave line in the payslip")
        self.assertEqual(work_line.number_of_hours, 3.0, "It should have 3 hours of work")
        self.assertEqual(leave_line.number_of_hours, 5.0, "It should have 5 hours of leave")

    def test_payslip_generation_with_extra_work(self):
        # /!\ this is in the weekend (Sunday) => no calendar attendance at this time
        start = datetime(2015, 11, 1, 10, 0, 0)
        end = datetime(2015, 11, 1, 17, 0, 0)
        work_entry = self.env['hr.work.entry'].create({
            'name': 'Extra',
            'employee_id': self.richard_emp.id,
            'contract_id': self.richard_emp.contract_id.id,
            'work_entry_type_id': self.work_entry_type.id,
            'date_start': start,
            'date_stop': end,
        })
        work_entry.action_validate()
        payslip_wizard = self.env['hr.payslip.employees'].create({'employee_ids': [(4, self.richard_emp.id)]})
        payslip_wizard.with_context({
            'default_date_start': Date.to_string(start),
            'default_date_end': Date.to_string(end + relativedelta(days=1))
            }).compute_sheet()
        payslip = self.env['hr.payslip'].search([('employee_id', '=', self.richard_emp.id)])
        work_line = payslip.worked_days_line_ids.filtered(lambda l: l.work_entry_type_id == self.env.ref('hr_payroll.work_entry_type_attendance')) # From default calendar.attendance
        leave_line = payslip.worked_days_line_ids.filtered(lambda l: l.work_entry_type_id == self.work_entry_type)

        self.assertTrue(work_line, "It should have a work line in the payslip")
        self.assertTrue(leave_line, "It should have an extra work line in the payslip")
        self.assertEqual(work_line.number_of_hours, 8.0, "It should have 8 hours of work")  # Monday
        self.assertEqual(leave_line.number_of_hours, 7.0, "It should have 5 hours of extra work")  # Sunday

    def test_multiple_work_entry_types_data(self):
        self.env['resource.calendar.leaves'].create({
            'name': 'leave name',
            'date_from': self.start + relativedelta(days=1),
            'date_to': self.start + relativedelta(days=1, hours=15),
            'resource_id': self.richard_emp.resource_id.id,
            'calendar_id': self.richard_emp.resource_calendar_id.id,
            'work_entry_type_id': self.work_entry_type_leave.id,
            'time_type': 'leave',
        })
        self.env['resource.calendar.attendance'].create({
            'name': 'unpaid name',
            'dayofweek': '4',
            'hour_from': 8.0,
            'hour_to': 17.0,
            'resource_id': self.richard_emp.resource_id.id,
            'calendar_id': self.richard_emp.resource_calendar_id.id,
            'work_entry_type_id': self.work_entry_type.id,
        })
        data = self.richard_emp._get_work_entry_days_data(self.work_entry_type_leave | self.work_entry_type, self.start, self.end)
        self.assertEqual(data['hours'], 44.0, "It shoudl be the sum of both work entry types")
