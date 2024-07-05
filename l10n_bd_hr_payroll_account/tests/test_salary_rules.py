# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date

from odoo.tests.common import tagged
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tools.float_utils import float_compare


@tagged('post_install', 'post_install_l10n', '-at_install', 'payslips_validation')
class TestPayslipValidation(AccountTestInvoicingCommon):

    @classmethod
    @AccountTestInvoicingCommon.setup_country('bd')
    def setUpClass(cls):
        super().setUpClass()

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

    def test_male_payslip_1(self):
        self.contract.wage = 40000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 40000.0,
            'GROSS': 40000.0,
            'TAXABLE_AMOUNT': 26666.67,
            'TAXES': -416.67,
            'NET': 39583.33,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_male_payslip_2(self):
        self.contract.wage = 60000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 60000.0,
            'GROSS': 60000.0,
            'TAXABLE_AMOUNT': 40000.0,
            'TAXES': -666.67,
            'NET': 59333.33,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_male_payslip_3(self):
        self.contract.wage = 80000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 80000.0,
            'GROSS': 80000.0,
            'TAXABLE_AMOUNT': 53333.33,
            'TAXES': -2000.0,
            'NET': 78000.0,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_female_payslip_1(self):
        self.employee.gender = 'female'
        self.contract.wage = 40000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 40000.0,
            'GROSS': 40000.0,
            'TAXABLE_AMOUNT': 26666.67,
            'TAXES': -416.67,
            'NET': 39583.33,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_female_payslip_2(self):
        self.employee.gender = 'female'
        self.contract.wage = 60000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 60000.0,
            'GROSS': 60000.0,
            'TAXABLE_AMOUNT': 40000.0,
            'TAXES': -416.67,
            'NET': 59583.33,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_female_payslip_3(self):
        self.employee.gender = 'female'
        self.contract.wage = 80000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 80000.0,
            'GROSS': 80000.0,
            'TAXABLE_AMOUNT': 53333.33,
            'TAXES': -1583.33,
            'NET': 78416.67,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_disabled_payslip_1(self):
        self.employee.l10n_bd_disabled = True
        self.contract.wage = 40000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 40000.0,
            'GROSS': 40000.0,
            'TAXABLE_AMOUNT': 26666.67,
            'TAXES': -416.67,
            'NET': 39583.33,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_disabled_payslip_2(self):
        self.employee.l10n_bd_disabled = True
        self.contract.wage = 60000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 60000.0,
            'GROSS': 60000.0,
            'TAXABLE_AMOUNT': 40000.0,
            'TAXES': -416.67,
            'NET': 59583.33,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_disabled_payslip_3(self):
        self.employee.l10n_bd_disabled = True
        self.contract.wage = 80000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 80000.0,
            'GROSS': 80000.0,
            'TAXABLE_AMOUNT': 53333.33,
            'TAXES': -958.33,
            'NET': 79041.67,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_gazetted_freedom_fighter_payslip_1(self):
        self.employee.l10n_bd_gazetted_war_founded_freedom_fighter = True
        self.contract.wage = 40000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 40000.0,
            'GROSS': 40000.0,
            'TAXABLE_AMOUNT': 26666.67,
            'TAXES': -416.67,
            'NET': 39583.33,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_gazetted_freedom_fighter_payslip_2(self):
        self.employee.l10n_bd_gazetted_war_founded_freedom_fighter = True
        self.contract.wage = 60000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 60000.0,
            'GROSS': 60000.0,
            'TAXABLE_AMOUNT': 40000.0,
            'TAXES': -416.67,
            'NET': 59583.33,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_gazetted_freedom_fighter_payslip_3(self):
        self.employee.l10n_bd_gazetted_war_founded_freedom_fighter = True
        self.contract.wage = 80000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 80000.0,
            'GROSS': 80000.0,
            'TAXABLE_AMOUNT': 53333.33,
            'TAXES': -750.0,
            'NET': 79250.0,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_senior_payslip_1(self):
        self.employee.birthday = date(1950, 1, 1)
        self.contract.wage = 40000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 40000.0,
            'GROSS': 40000.0,
            'TAXABLE_AMOUNT': 26666.67,
            'TAXES': -416.67,
            'NET': 39583.33,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_senior_payslip_2(self):
        self.employee.birthday = date(1950, 1, 1)
        self.contract.wage = 60000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 60000.0,
            'GROSS': 60000.0,
            'TAXABLE_AMOUNT': 40000.0,
            'TAXES': -416.67,
            'NET': 59583.33,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_senior_payslip_3(self):
        self.employee.birthday = date(1950, 1, 1)
        self.contract.wage = 80000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 80000.0,
            'GROSS': 80000.0,
            'TAXABLE_AMOUNT': 53333.33,
            'TAXES': -1583.33,
            'NET': 78416.67,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_disabled_dependent_payslip_1(self):
        self.employee.l10n_bd_disabled_dependent = 5
        self.contract.wage = 40000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 40000.0,
            'GROSS': 40000.0,
            'TAXABLE_AMOUNT': 26666.67,
            'TAXES': -416.67,
            'NET': 39583.33,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_disabled_dependent_payslip_2(self):
        self.employee.l10n_bd_disabled_dependent = 5
        self.contract.wage = 60000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 60000.0,
            'GROSS': 60000.0,
            'TAXABLE_AMOUNT': 40000.0,
            'TAXES': -416.67,
            'NET': 59583.33,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_disabled_dependent_payslip_3(self):
        self.employee.l10n_bd_disabled_dependent = 5
        self.contract.wage = 80000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {
            'BASIC': 80000.0,
            'GROSS': 80000.0,
            'TAXABLE_AMOUNT': 53333.33,
            'TAXES': -1583.33,
            'NET': 78416.67,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_other_inputs_payslip_1(self):
        self.contract.wage = 40000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        other_inputs = {
            'l10n_bd_hr_payroll.input_other_allowances': 2000,
            'l10n_bd_hr_payroll.input_salary_arrears': 3000,
            'l10n_bd_hr_payroll.input_extra_hours': 500,
            'l10n_bd_hr_payroll.input_tax_credits': 100,
            'l10n_bd_hr_payroll.input_provident_fund': 400,
            'l10n_bd_hr_payroll.input_gratuity_fund': 300,
        }
        for other_input, amount in other_inputs.items():
            self.env['hr.payslip.input'].create({
                'payslip_id': payslip.id,
                'input_type_id': self.env.ref(other_input).id,
                'amount': amount,
            })
        payslip.compute_sheet()
        payslip_results = {
            'BASIC': 40000.0,
            'EXTRA_HOURS': 500.0,
            'GRAT_FUND': 300.0,
            'OTHER_ALLOW': 2000.0,
            'PROV_FUND': 400.0,
            'SALARY_ARREARS': 3000.0,
            'GROSS': 46200.0,
            'TAX_CREDITS': 100.0,
            'TAXABLE_AMOUNT': 30700.0,
            'TAXES': -416.67,
            'NET': 45783.33,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_other_inputs_payslip_2(self):
        self.contract.wage = 60000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        other_inputs = {
            'l10n_bd_hr_payroll.input_other_allowances': 2000,
            'l10n_bd_hr_payroll.input_salary_arrears': 3000,
            'l10n_bd_hr_payroll.input_extra_hours': 500,
            'l10n_bd_hr_payroll.input_tax_credits': 100,
            'l10n_bd_hr_payroll.input_provident_fund': 400,
            'l10n_bd_hr_payroll.input_gratuity_fund': 300,
        }
        for other_input, amount in other_inputs.items():
            self.env['hr.payslip.input'].create({
                'payslip_id': payslip.id,
                'input_type_id': self.env.ref(other_input).id,
                'amount': amount,
            })
        payslip.compute_sheet()
        payslip_results = {
            'BASIC': 60000.0,
            'EXTRA_HOURS': 500.0,
            'GRAT_FUND': 300.0,
            'OTHER_ALLOW': 2000.0,
            'PROV_FUND': 400.0,
            'SALARY_ARREARS': 3000.0,
            'GROSS': 66200.0,
            'TAX_CREDITS': 100.0,
            'TAXABLE_AMOUNT': 44033.33,
            'TAXES': -1070.0,
            'NET': 65130.0,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_other_inputs_payslip_3(self):
        self.contract.wage = 80000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        other_inputs = {
            'l10n_bd_hr_payroll.input_other_allowances': 2000,
            'l10n_bd_hr_payroll.input_salary_arrears': 3000,
            'l10n_bd_hr_payroll.input_extra_hours': 500,
            'l10n_bd_hr_payroll.input_tax_credits': 100,
            'l10n_bd_hr_payroll.input_provident_fund': 400,
            'l10n_bd_hr_payroll.input_gratuity_fund': 300,
        }
        for other_input, amount in other_inputs.items():
            self.env['hr.payslip.input'].create({
                'payslip_id': payslip.id,
                'input_type_id': self.env.ref(other_input).id,
                'amount': amount,
            })
        payslip.compute_sheet()
        payslip_results = {
            'BASIC': 80000.0,
            'EXTRA_HOURS': 500.0,
            'GRAT_FUND': 300.0,
            'OTHER_ALLOW': 2000.0,
            'PROV_FUND': 400.0,
            'SALARY_ARREARS': 3000.0,
            'GROSS': 86200.0,
            'TAX_CREDITS': 100.0,
            'TAXABLE_AMOUNT': 57366.67,
            'TAXES': -2403.33,
            'NET': 83796.67,
        }
        self._validate_payslip(payslip, payslip_results)
