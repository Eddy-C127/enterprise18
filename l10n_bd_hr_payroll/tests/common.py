# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date

from odoo.tests.common import TransactionCase
from odoo.tools.float_utils import float_compare
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestPayrollCommon(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.bd_company = cls.env.ref('l10n_bd_hr_payroll.demo_company_bd')

        cls.env.user.company_ids |= cls.bd_company
        cls.env = cls.env(context=dict(cls.env.context, allowed_company_ids=cls.bd_company.ids))

        cls.work_contact = cls.env['res.partner'].create({
            'name': 'BD Employee',
            'company_id': cls.env.company.id,
        })
        cls.resource_calendar = cls.env['resource.calendar'].create([{
            'name': 'Test Calendar',
            'company_id': cls.env.company.id,
            'hours_per_day': 7.3,
            'tz': "Asia/Dhaka",
            'two_weeks_calendar': False,
            'hours_per_week': 44,
            'full_time_required_hours': 44,
            'attendance_ids': [(5, 0, 0)] + [(0, 0, {
                'name': "Attendance",
                'dayofweek': dayofweek,
                'hour_from': hour_from,
                'hour_to': hour_to,
                'day_period': day_period,
                'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id

            }) for dayofweek, hour_from, hour_to, day_period in [
                ("0", 8.0, 12.0, "morning"),
                ("0", 13.0, 18.0, "afternoon"),
                ("1", 8.0, 12.0, "morning"),
                ("1", 13.0, 18.0, "afternoon"),
                ("2", 8.0, 12.0, "morning"),
                ("2", 13.0, 18.0, "afternoon"),
                ("3", 8.0, 12.0, "morning"),
                ("3", 13.0, 18.0, "afternoon"),
                ("4", 8.0, 12.0, "morning"),
                ("4", 13.0, 17.0, "afternoon"),
            ]],
        }])

        cls.bd_company.write({
            'resource_calendar_id': cls.resource_calendar.id,
        })

        cls.employee = cls.env['hr.employee'].create({
            'name': 'BD Employee',
            'address_id': cls.work_contact.id,
            'resource_calendar_id': cls.resource_calendar.id,
            'company_id': cls.env.company.id,
            'country_id': cls.env.ref('base.bd').id,
            'gender': 'male',
        })

        cls.contract = cls.env['hr.contract'].create({
            'name': "BD Employee's contract",
            'employee_id': cls.employee.id,
            'resource_calendar_id': cls.resource_calendar.id,
            'company_id': cls.env.company.id,
            'structure_type_id': cls.env.ref('l10n_bd_hr_payroll.structure_type_employee_bd').id,
            'date_start': date(2016, 1, 1),
            'wage': 40000,
            'state': "open",
            'work_time_rate': 1.0,
        })

    @classmethod
    def _generate_payslip(cls, date_from, date_to, struct_id=False):
        work_entries = cls.contract.generate_work_entries(date_from, date_to)
        payslip = cls.env['hr.payslip'].create([{
            'name': "Test Payslip",
            'employee_id': cls.employee.id,
            'contract_id': cls.contract.id,
            'company_id': cls.env.company.id,
            'struct_id': struct_id or cls.env.ref('l10n_bd_hr_payroll.hr_payroll_structure_bd_employee_salary').id,
            'date_from': date_from,
            'date_to': date_to,
        }])
        work_entries.action_validate()
        payslip.compute_sheet()
        return payslip

    def _validate_payslip(self, payslip, results):
        error = []
        line_values = payslip._get_line_values(set(results.keys()) | set(payslip.line_ids.mapped('code')))
        for code, value in results.items():
            payslip_line_value = line_values[code][payslip.id]['total']
            if float_compare(payslip_line_value, value, 2):
                error.append("Code: %s - Expected: %s - Reality: %s" % (code, value, payslip_line_value))
        for line in payslip.line_ids:
            if line.code not in results:
                error.append("Missing Line: '%s' - %s," % (line.code, line_values[line.code][payslip.id]['total']))
        if error:
            error.extend([
                "Payslip Actual Values: ",
                "        {",
            ])
            for line in payslip.line_ids:
                error.append("            '%s': %s," % (line.code, line_values[line.code][payslip.id]['total']))
            error.append("        }")
        self.assertEqual(len(error), 0, '\n' + '\n'.join(error))
