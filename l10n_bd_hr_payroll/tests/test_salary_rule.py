# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date

from odoo.addons.l10n_bd_hr_payroll.tests.common import TestPayrollCommon
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestSalaryRule(TestPayrollCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

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
