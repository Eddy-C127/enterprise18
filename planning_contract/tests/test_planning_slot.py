# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details
from datetime import datetime
from pytz import UTC, timezone

from .common import TestPlanningContractCommon
from odoo.addons.resource.models.utils import Intervals

class TestPlanningContract(TestPlanningContractCommon):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # This contract ends at the 15th of the month
        cls.contract_cdd = cls.env['hr.contract'].create({  # Fixed term contract
            'date_end': datetime.strptime('2015-11-15', '%Y-%m-%d'),
            'date_start': datetime.strptime('2015-01-01', '%Y-%m-%d'),
            'name': 'First CDD Contract for Jules',
            'resource_calendar_id': cls.calendar_40h.id,
            'wage': 5000.0,
            'employee_id': cls.employee_bert.id,
            'state': 'open',
            'kanban_state': 'blocked',
        })

        # This contract starts the next day
        cls.contract_cdi = cls.env['hr.contract'].create({
            'date_start': datetime.strptime('2015-11-16', '%Y-%m-%d'),
            'name': 'Contract for Jules',
            'resource_calendar_id': cls.calendar_35h.id,
            'wage': 5000.0,
            'employee_id': cls.employee_bert.id,
            'state': 'open',
            'kanban_state': 'normal',
        })

    def test_employee_contract_validity_per_period(self):
        start = datetime(2015, 11, 8, 00, 00, 00, tzinfo=UTC)
        end = datetime(2015, 11, 21, 23, 59, 59, tzinfo=UTC)
        calendars_validity_within_period = self.resource_bert._get_calendars_validity_within_period(start, end, default_company=self.employee_bert.company_id)
        tz = timezone(self.employee_bert.tz)

        self.assertEqual(len(calendars_validity_within_period[self.resource_bert.id]), 2, "There should exist 2 calendars within the period")
        interval_calendar_40h = Intervals([(
            start,
            tz.localize(datetime.combine(self.contract_cdd.date_end, datetime.max.time())),
            self.env['resource.calendar.attendance']
        )])
        interval_calendar_35h = Intervals([(
            tz.localize(datetime.combine(self.contract_cdi.date_start, datetime.min.time())),
            end,
            self.env['resource.calendar.attendance']
        )])
        computed_interval_40h = calendars_validity_within_period[self.resource_bert.id][self.calendar_40h]
        computed_interval_35h = calendars_validity_within_period[self.resource_bert.id][self.calendar_35h]
        self.assertFalse(computed_interval_40h - interval_calendar_40h, "The interval of validity for the 40h calendar must be from 2015-11-16 to 2015-11-21, not more")
        self.assertFalse(interval_calendar_40h - computed_interval_40h, "The interval of validity for the 40h calendar must be from 2015-11-16 to 2015-11-21, not less")
        self.assertFalse(computed_interval_35h - interval_calendar_35h, "The interval of validity for the 35h calendar must be from 2015-11-08 to 2015-11-15, not more")
        self.assertFalse(interval_calendar_35h - computed_interval_35h, "The interval of validity for the 35h calendar must be from 2015-11-08 to 2015-11-15, not less")

    def test_employee_work_intervals(self):
        start = datetime(2015, 11, 8, 00, 00, 00, tzinfo=UTC)
        end = datetime(2015, 11, 21, 23, 59, 59, tzinfo=UTC)
        work_intervals, _ = self.resource_bert._get_valid_work_intervals(start, end)
        sum_work_intervals = sum(
            (stop - start).total_seconds() / 3600
            for start, stop, _resource in work_intervals[self.resource_bert.id]
        )
        self.assertEqual(75, sum_work_intervals, "Sum of the work intervals for the employee Jules should be 40h+35h = 75h")

    def test_employee_work_planning_hours_info(self):
        planning_hours_info = self.env['planning.slot'].gantt_progress_bar(
            ['resource_id'], {'resource_id': self.resource_bert.ids}, '2015-11-08 00:00:00', '2015-11-21 23:59:59'
        )['resource_id']
        self.assertEqual(75, planning_hours_info[self.resource_bert.id]['max_value'], "Work hours for the employee Jules should be 40h+35h = 75h")
