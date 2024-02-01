# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import date

from odoo.tests import tagged
from .common import TestPayrollCommon


@tagged("post_install_l10n", "post_install", "-at_install", "l10n_au_hr_payroll")
class TestRegularPayslip(TestPayrollCommon):

    @classmethod
    def setUpClass(cls):
        super(TestRegularPayslip, cls).setUpClass()
        cls.default_payroll_structure = cls.env.ref("l10n_au_hr_payroll.hr_payroll_structure_au_regular")

    def test_regular_payslip_1(self):
        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'F',
            'scale': '2',
            'leave_loading': 'once',
            'leave_loading_rate': 17.5,
            'workplace_giving_type': 'both',
            'workplace_giving_employee': 100,
            'workplace_giving_employer': 100,
            'salary_sacrifice_superannuation': 100,
            'salary_sacrifice_other': 0,
            'wage_type': 'monthly',
            'wage': 5000,
            'casual_loading': 0,
        })
        self._test_payslip(
            employee,
            contract,
            expected_worked_days=[
                # (work_entry_type_id.id, number_of_day, number_of_hours, amount)
                (self.work_entry_types['WORK100'].id, 21, 159.6, 5000),
            ],
            expected_lines=[
                # (code, total)
                ('BASIC', 5000),
                ('OTE', 5050),
                ('GROSS.COMMISSION', 50),
                ('SALARY.SACRIFICE.TOTAL', -200),
                ('WORKPLACE.GIVING', -100),
                ('GROSS', 4700),
                ('WITHHOLD', -845),
                ('MEDICARE', 0),
                ('WITHHOLD.TOTAL', -845),
                ('NET', 3905),
                ('SALARY.SACRIFICE.OTHER', -100),
                ('SUPER.CONTRIBUTION', 100),
                ('SUPER', 555.5),
            ],
            input_lines=[{
                'input_type_id': self.env.ref('l10n_au_hr_payroll.input_gross_director_fee').id,
                'amount': 50,
            }]
        )

    def test_regular_payslip_2(self):
        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'F',
            'scale': '2',
            'leave_loading': 'regular',
            'leave_loading_rate': 17.5,
            'workplace_giving_type': 'employer_deduction',
            'workplace_giving_employee': 0,
            'workplace_giving_employer': 100,
            'salary_sacrifice_superannuation': 100,
            'salary_sacrifice_other': 0,
            'wage_type': 'monthly',
            'wage': 5000,
            'casual_loading': 0,
        })
        self._test_payslip(
            employee,
            contract,
            expected_worked_days=[
                # (work_entry_type_id.id, number_of_day, number_of_hours, amount)
                (self.work_entry_types['WORK100'].id, 21, 159.6, 5000),
            ],
            expected_lines=[
                # (code, total)
                ('BASIC', 5000),
                ('OTE', 5000),
                ('SALARY.SACRIFICE.TOTAL', -200),
                ('GROSS', 4800),
                ('WITHHOLD', -862),
                ('MEDICARE', 0),
                ('WITHHOLD.TOTAL', -862),
                ('NET', 3938),
                ('SALARY.SACRIFICE.OTHER', -100),
                ('SUPER.CONTRIBUTION', 100),
                ('SUPER', 550),
            ],
        )

    def test_regular_payslip_3(self):
        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'F',
            'scale': '1',
            'leave_loading': 'once',
            'leave_loading_rate': 17.5,
            'workplace_giving_type': 'employee_deduction',
            'workplace_giving_employee': 200,
            'workplace_giving_employer': 0,
            'salary_sacrifice_superannuation': 0,
            'salary_sacrifice_other': 100,
            'wage_type': 'monthly',
            'wage': 5000,
            'casual_loading': 0,
        })
        self._test_payslip(
            employee,
            contract,
            expected_worked_days=[
                # (work_entry_type_id.id, number_of_day, number_of_hours, amount)
                (self.work_entry_types['WORK100'].id, 21, 159.6, 5000),
            ],
            expected_lines=[
                # (code, total)
                ('BASIC', 5000),
                ('OTE', 5000),
                ('SALARY.SACRIFICE.TOTAL', -100),
                ('WORKPLACE.GIVING', -200),
                ('GROSS', 4700),
                ('WITHHOLD', -1352),
                ('WITHHOLD.TOTAL', -1352),
                ('NET', 3348),
                ('SALARY.SACRIFICE.OTHER', -100),
                ('SUPER', 550),
            ],
        )

    def test_regular_payslip_4(self):
        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'F',
            'scale': '1',
            'leave_loading': 'regular',
            'leave_loading_rate': 17.5,
            'workplace_giving_type': 'none',
            'workplace_giving_employee': 0,
            'workplace_giving_employer': 0,
            'salary_sacrifice_superannuation': 100,
            'salary_sacrifice_other': 100,
            'wage_type': 'monthly',
            'wage': 5000,
            'casual_loading': 0,
        })
        self._test_payslip(
            employee,
            contract,
            expected_worked_days=[
                # (work_entry_type_id.id, number_of_day, number_of_hours, amount)
                (self.work_entry_types['WORK100'].id, 21, 159.6, 5000),
            ],
            expected_lines=[
                # (code, total)
                ('BASIC', 5000),
                ('OTE', 5000),
                ('SALARY.SACRIFICE.TOTAL', -200),
                ('GROSS', 4800),
                ('WITHHOLD', -1387),
                ('WITHHOLD.TOTAL', -1387),
                ('NET', 3413),
                ('SALARY.SACRIFICE.OTHER', -100),
                ('SUPER.CONTRIBUTION', 100),
                ('SUPER', 550),
            ],
        )

    def test_regular_payslip_5(self):
        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'F',
            'scale': '4',
            'tfn': False,
            'leave_loading': 'regular',
            'leave_loading_rate': 17.5,
            'workplace_giving_type': 'both',
            'workplace_giving_employee': 100,
            'workplace_giving_employer': 100,
            'salary_sacrifice_superannuation': 100,
            'salary_sacrifice_other': 0,
            'wage_type': 'monthly',
            'wage': 5000,
            'casual_loading': 0,
        })
        self._test_payslip(
            employee,
            contract,
            expected_worked_days=[
                # (work_entry_type_id.id, number_of_day, number_of_hours, amount)
                (self.work_entry_types['WORK100'].id, 21, 159.6, 5000),
            ],
            expected_lines=[
                # (code, total)
                ('BASIC', 5000),
                ('OTE', 5000),
                ('SALARY.SACRIFICE.TOTAL', -200),
                ('WORKPLACE.GIVING', -100),
                ('GROSS', 4700),
                ('WITHHOLD', -2207.75),
                ('WITHHOLD.TOTAL', -2207.75),
                ('NET', 2492.25),
                ('SALARY.SACRIFICE.OTHER', -100),
                ('SUPER.CONTRIBUTION', 100),
                ('SUPER', 550),
            ],
        )

    def test_regular_payslip_weekly_withholding_extra(self):
        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'F',
            'scale': '1',
            'leave_loading': 'regular',
            'leave_loading_rate': 17.5,
            'workplace_giving_type': 'none',
            'workplace_giving_employee': 0,
            'workplace_giving_employer': 0,
            'salary_sacrifice_superannuation': 100,
            'salary_sacrifice_other': 100,
            'wage_type': 'monthly',
            'schedule_pay': 'weekly',
            'wage': 1250,
            'casual_loading': 0,
            'extra_pay': True,
        })
        payslip_date = date(2023, 7, 3)
        payslip_end_date = date(2023, 7, 9)
        self._test_payslip(
            employee,
            contract,
            expected_worked_days=[
                # (work_entry_type_id.id, number_of_day, number_of_hours, amount)
                (self.work_entry_types['WORK100'].id, 5, 38, 1250),
            ],
            expected_lines=[
                # (code, total)
                ('BASIC', 1250),
                ('OTE', 1250),
                ('SALARY.SACRIFICE.TOTAL', -200),
                ('GROSS', 1050),
                ('WITHHOLD', -301),
                ('WITHHOLD.EXTRA', -3),
                ('WITHHOLD.TOTAL', -304),
                ('NET', 746),
                ('SALARY.SACRIFICE.OTHER', -100),
                ('SUPER.CONTRIBUTION', 100),
                ('SUPER', 137.5),
            ],
            payslip_date_from=payslip_date,
            payslip_date_to=payslip_end_date,
        )
