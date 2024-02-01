# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import tagged

from .common import TestPayrollCommon


@tagged("post_install_l10n", "post_install", "-at_install", "l10n_au_hr_payroll")
class TestPayrollReturnToWork(TestPayrollCommon):

    @classmethod
    def setUpClass(cls):
        super(TestPayrollReturnToWork, cls).setUpClass()
        cls.default_payroll_structure = cls.env.ref("l10n_au_hr_payroll.hr_payroll_structure_au_return_to_work")

    def test_return_to_work_payslip_1(self):
        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'F',
            'scale': '2',
            'leave_loading': 'regular',
            'leave_loading_rate': 17.5,
            'workplace_giving_type': 'none',
            'workplace_giving_employee': 0,
            'workplace_giving_employer': 0,
            'salary_sacrifice_superannuation': 0,
            'salary_sacrifice_other': 0,
            'wage_type': 'monthly',
            'wage': 18000,
            'casual_loading': 0,
        })
        self._test_payslip(
            employee,
            contract,
            expected_lines=[
                # (code, total)
                ('OTE', 18000),
                ('B2WORK', 18000),
                ('GROSS', 18000),
                ('WITHHOLD', -6210),
                ('WITHHOLD.TOTAL', -6210),
                ('NET', 11790),
                ('SUPER', 1980),
            ],
            input_lines=[{
                'input_type_id': self.env.ref('l10n_au_hr_payroll.input_b2work').id,
                'amount': 18000,
            }]
        )

    def test_return_to_work_payslip_2(self):
        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'F',
            'scale': '4',
            'leave_loading': 'regular',
            'leave_loading_rate': 17.5,
            'workplace_giving_type': 'none',
            'workplace_giving_employee': 0,
            'workplace_giving_employer': 0,
            'salary_sacrifice_superannuation': 0,
            'salary_sacrifice_other': 0,
            'wage_type': 'monthly',
            'wage': 18000,
            'casual_loading': 0,
            'tfn_declaration': '000000000',
            'tfn': False,
        })
        self._test_payslip(
            employee,
            contract,
            expected_lines=[
                # (code, total)
                ('OTE', 18000),
                ('B2WORK', 18000),
                ('GROSS', 18000),
                ('WITHHOLD', -8460),
                ('WITHHOLD.TOTAL', -8460),
                ('NET', 9540),
                ('SUPER', 1980),
            ],
            input_lines=[{
                'input_type_id': self.env.ref('l10n_au_hr_payroll.input_b2work').id,
                'amount': 18000,
            }]
        )

    def test_return_to_work_payslip_3(self):
        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'F',
            'scale': '3',
            'leave_loading': 'regular',
            'leave_loading_rate': 17.5,
            'workplace_giving_type': 'none',
            'workplace_giving_employee': 0,
            'workplace_giving_employer': 0,
            'salary_sacrifice_superannuation': 0,
            'salary_sacrifice_other': 0,
            'wage_type': 'monthly',
            'wage': 18000,
            'casual_loading': 0,
            'tfn_declaration': '000000000',
            'tfn': False,
        })
        self._test_payslip(
            employee,
            contract,
            expected_lines=[
                # (code, total)
                ('OTE', 18000),
                ('B2WORK', 18000),
                ('GROSS', 18000),
                ('WITHHOLD', -8100),
                ('WITHHOLD.TOTAL', -8100),
                ('NET', 9900),
                ('SUPER', 1980),
            ],
            input_lines=[{
                'input_type_id': self.env.ref('l10n_au_hr_payroll.input_b2work').id,
                'amount': 18000,
            }]
        )
