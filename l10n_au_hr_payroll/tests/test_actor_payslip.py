# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import date

from odoo.tests import tagged

from .common import TestPayrollCommon


@tagged("post_install_l10n", "post_install", "-at_install", "l10n_au_hr_payroll")
class TestPayrollActor(TestPayrollCommon):

    @classmethod
    def setUpClass(cls):
        super(TestPayrollActor, cls).setUpClass()
        cls.default_payroll_structure = cls.env.ref("l10n_au_hr_payroll.hr_payroll_structure_au_actor")

    def test_actor_payslip_1(self):
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
            'schedule_pay': 'weekly',
            'wage': 5000,
            'casual_loading': 0,
            'performances_per_week': 1,
        })
        payslip_date = date(2023, 7, 3)
        payslip_end_date = date(2023, 7, 9)
        self._test_payslip(
            employee,
            contract,
            expected_worked_days=[
                # (work_entry_type_id.id, number_of_day, number_of_hours, amount)
                (self.work_entry_types['WORK100'].id, 5, 38, 5000),
            ],
            expected_lines=[
                # (code, total)
                ('BASIC', 5000),
                ('OTE', 5000),
                ('GROSS', 5000),
                ('WITHHOLD', -1317),
                ('WITHHOLD.TOTAL', -1317),
                ('NET', 3683),
                ('SUPER', 550),
            ],
            payslip_date_from=payslip_date,
            payslip_date_to=payslip_end_date,
        )

    def test_actor_payslip_2(self):
        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'F',
            'scale': '1',
            'leave_loading': 'regular',
            'leave_loading_rate': 17.5,
            'workplace_giving_type': 'none',
            'workplace_giving_employee': 0,
            'workplace_giving_employer': 0,
            'salary_sacrifice_superannuation': 0,
            'salary_sacrifice_other': 0,
            'wage_type': 'monthly',
            'schedule_pay': 'weekly',
            'wage': 5000,
            'casual_loading': 0,
            'performances_per_week': 1,
        })
        payslip_date = date(2023, 7, 3)
        payslip_end_date = date(2023, 7, 9)
        self._test_payslip(
            employee,
            contract,
            expected_worked_days=[
                # (work_entry_type_id.id, number_of_day, number_of_hours, amount)
                (self.work_entry_types['WORK100'].id, 5, 38, 5000),
            ],
            expected_lines=[
                # (code, total)
                ('BASIC', 5000),
                ('OTE', 5000),
                ('GROSS', 5000),
                ('WITHHOLD', -1481),
                ('WITHHOLD.TOTAL', -1481),
                ('NET', 3519),
                ('SUPER', 550),
            ],
            payslip_date_from=payslip_date,
            payslip_date_to=payslip_end_date,
        )
