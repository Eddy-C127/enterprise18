# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date

from odoo.tests.common import tagged
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tools.float_utils import float_compare


@tagged('post_install', 'post_install_l10n', '-at_install', 'payslips_validation')
class TestPayslipValidation(AccountTestInvoicingCommon):

    @classmethod
    @AccountTestInvoicingCommon.setup_country('tr')
    def setUpClass(cls):
        super().setUpClass()

        cls.work_contact = cls.env['res.partner'].create({
            'name': 'TR Employee',
            'company_id': cls.env.company.id,
        })
        cls.resource_calendar = cls.env['resource.calendar'].create([{
            'name': 'Test Calendar',
            'company_id': cls.env.company.id,
            'hours_per_day': 7.3,
            'tz': "Europe/Brussels",
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
                ("0", 12.0, 13.0, "lunch"),
                ("0", 13.0, 18.0, "afternoon"),
                ("1", 8.0, 12.0, "morning"),
                ("1", 12.0, 13.0, "lunch"),
                ("1", 13.0, 18.0, "afternoon"),
                ("2", 8.0, 12.0, "morning"),
                ("2", 12.0, 13.0, "lunch"),
                ("2", 13.0, 18.0, "afternoon"),
                ("3", 8.0, 12.0, "morning"),
                ("3", 12.0, 13.0, "lunch"),
                ("3", 13.0, 18.0, "afternoon"),
                ("4", 8.0, 12.0, "morning"),
                ("4", 12.0, 13.0, "lunch"),
                ("4", 13.0, 17.0, "afternoon"),
            ]],
        }])

        cls.employee = cls.env['hr.employee'].create({
            'name': 'TR Employee',
            'address_id': cls.work_contact.id,
            'resource_calendar_id': cls.resource_calendar.id,
            'company_id': cls.env.company.id,
            'country_id': cls.env.ref('base.tr').id,
        })

        cls.contract = cls.env['hr.contract'].create({
            'name': "TR Employee's contract",
            'employee_id': cls.employee.id,
            'resource_calendar_id': cls.resource_calendar.id,
            'company_id': cls.env.company.id,
            'structure_type_id': cls.env.ref('l10n_tr_hr_payroll.structure_type_employee_tr').id,
            'date_start': date(2016, 1, 1),
            'wage': 50000,
            'state': "open",
        })

    @classmethod
    def _generate_payslip(cls, date_from, date_to, struct_id=False):
        work_entries = cls.contract.generate_work_entries(date_from, date_to)
        payslip = cls.env['hr.payslip'].create([{
            'name': "Test Payslip",
            'employee_id': cls.employee.id,
            'contract_id': cls.contract.id,
            'company_id': cls.env.company.id,
            'struct_id': struct_id or cls.env.ref('l10n_tr_hr_payroll.hr_payroll_structure_tr_employee_salary').id,
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

    def test_basic_payslip(self):
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 50000.0,
            'SSIEDED': -7000.0,
            'SSIDED': -500.0,
            'SSICDED': 10250.0,
            'SSIUCDED': 1000.0,
            'GROSS': 50000.0,
            'TAXB': 42500.0,
            'TOTTB': 6375.0,
            'BTAXNET': -3824.68,
            'STAX': -227.68,
            'NETTAX': -4052.36,
            'NET': 38447.64,
        }
        self._validate_payslip(payslip, payslip_results)
