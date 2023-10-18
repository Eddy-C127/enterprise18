# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tools.float_utils import float_compare


class TestL10nIDHrPayrollAccountCommon(AccountTestInvoicingCommon):

    @classmethod
    @AccountTestInvoicingCommon.setup_country('id')
    def setUpClass(cls):
        super().setUpClass()

        cls.company_data['company'].write({
            'country_id': cls.env.ref('base.id').id,
        })

        cls.company = cls.env.company

        admin = cls.env['res.users'].search([('login', '=', 'admin')])
        admin.company_ids |= cls.company

        cls.env.user.tz = 'Asia/Jakarta'

        cls.resource_calendar_40_hours_per_week = cls.env['resource.calendar'].create({
            'name': "Test Calendar : 40 Hours/Week",
            'company_id': cls.company.id,
            'hours_per_day': 8.0,
            'tz': "Asia/Jakarta",
            'two_weeks_calendar': False,
            'hours_per_week': 40,
            'full_time_required_hours': 40,
            'attendance_ids': [
                (5, 0, 0),
                (0, 0, {'name': 'Monday Morning', 'dayofweek': '0', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Monday Afternoon', 'dayofweek': '0', 'hour_from': 13, 'hour_to': 17.0, 'day_period': 'afternoon'}),
                (0, 0, {'name': 'Tuesday Morning', 'dayofweek': '1', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Tuesday Afternoon', 'dayofweek': '1', 'hour_from': 13, 'hour_to': 17.0, 'day_period': 'afternoon'}),
                (0, 0, {'name': 'Wednesday Morning', 'dayofweek': '2', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Wednesday Afternoon', 'dayofweek': '2', 'hour_from': 13, 'hour_to': 17.0, 'day_period': 'afternoon'}),
                (0, 0, {'name': 'Thursday Morning', 'dayofweek': '3', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Thursday Afternoon', 'dayofweek': '3', 'hour_from': 13, 'hour_to': 17.0, 'day_period': 'afternoon'}),
                (0, 0, {'name': 'Friday Morning', 'dayofweek': '4', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Friday Afternoon', 'dayofweek': '4', 'hour_from': 13, 'hour_to': 17.0, 'day_period': 'afternoon'}),
            ]
        })

        # update salary journal
        cls.env.ref('l10n_id_hr_payroll.hr_payroll_structure_id_employee_salary').write({
            'journal_id': cls.company_data['default_journal_misc']
        })

    @classmethod
    def _generate_payslip(cls, date_from, date_to, struct_id=False, input_line_ids=False):
        work_entries = cls.contract.generate_work_entries(date_from, date_to)
        payslip = cls.env['hr.payslip'].create([{
            'name': "Test Payslip",
            'employee_id': cls.employee.id,
            'contract_id': cls.contract.id,
            'company_id': cls.env.company.id,
            'struct_id': struct_id or cls.env.ref('l10n_id_hr_payroll.hr_payroll_structure_id_employee_salary').id,
            'date_from': date_from,
            'date_to': date_to,
            'input_line_ids': input_line_ids or [],
        }])
        work_entries.action_validate()
        payslip.compute_sheet()
        return payslip

    @classmethod
    def _generate_leave(cls, date_from, date_to, holiday_status_id):
        return cls.env['hr.leave'].create({
            'employee_id': cls.employee.id,
            'request_date_from': date_from,
            'request_date_to': date_to,
            'holiday_status_id': cls.env.ref(holiday_status_id).id,
        }).action_validate()

    def _validate_payslip(self, payslip, results):
        """ Utility to easily check for component-by-component calculation """
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
                "Payslip Period: %s - %s" % (payslip.date_from, payslip.date_to),
                "Payslip Actual Values: ",
                "        {",
            ])
            for line in payslip.line_ids:
                error.append("            '%s': %s," % (line.code, line_values[line.code][payslip.id]['total']))
            error.append("        }")
        self.assertEqual(len(error), 0, '\n' + '\n'.join(error))

    def _get_payslip_values(self, payslip):
        """ Utility to easily retrieve amount for each code """
        line_vals = payslip._get_line_values(set(payslip.line_ids.mapped('code')))
        return {line.code: line_vals[line.code][payslip.id]['total'] for line in payslip.line_ids}
