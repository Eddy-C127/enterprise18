# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date

from dateutil.relativedelta import relativedelta

from odoo.tests import tagged

from .common import TestPayrollCommon


@tagged("post_install_l10n", "post_install", "-at_install", "l10n_au_hr_payroll")
class TestPayrollWhm(TestPayrollCommon):

    @classmethod
    def setUpClass(cls):
        super(TestPayrollWhm, cls).setUpClass()
        cls.default_payroll_structure = cls.env.ref("l10n_au_hr_payroll.hr_payroll_structure_au_whm")

    def test_whm_payslip_1(self):
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
                ('GROSS', 5000),
                ('WITHHOLD', -750),
                ('WITHHOLD.TOTAL', -750),
                ('NET', 4250),
                ('SUPER', 550),
            ],
        )

    def test_whm_payslip_2(self):
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
            'wage': 5000,
            'casual_loading': 0,
            'tfn': False,
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
                ('GROSS', 5000),
                ('WITHHOLD', -2250),
                ('WITHHOLD.TOTAL', -2250),
                ('NET', 2750),
                ('SUPER', 550),
            ],
        )

    def test_whm_payslip_3(self):
        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'F',
            'scale': '3',
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
                ('OTE', 5000),
                ('SALARY.SACRIFICE.TOTAL', -200),
                ('WORKPLACE.GIVING', -100),
                ('GROSS', 4700),
                ('WITHHOLD', -705),
                ('WITHHOLD.TOTAL', -705),
                ('NET', 3995),
                ('SALARY.SACRIFICE.OTHER', -100),
                ('SUPER.CONTRIBUTION', 100),
                ('SUPER', 550),
            ],
        )

    def test_whm_payslip_4(self):
        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'F',
            'scale': '4',
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
                ('WITHHOLD', -2160),
                ('WITHHOLD.TOTAL', -2160),
                ('NET', 2640),
                ('SALARY.SACRIFICE.OTHER', -100),
                ('SUPER.CONTRIBUTION', 100),
                ('SUPER', 550),
            ],
        )

    def test_whm_payslip_5(self):
        """ Test the whm payslip on a one-year duration, ensuring the expected withholding is applied.
        Do not follow exactly the scale, but if the total amount exceeds the previous threshold then we apply the next scale.
        """
        expected_withholding = [
            -2700,
            -2700,
            -2700,
            -5850,
            -5850,
            -5850,
            -5850,
            -6660,
            -6660,
            -6660,
            -8100,
            -8100,
        ]
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
        })
        initial_payslip_date = date(2023, 7, 1)
        for month in range(0, 12):
            payslip_date = initial_payslip_date + relativedelta(months=month)
            payslip_end_date = payslip_date + relativedelta(day=31)

            # Recompute hours & days information to build the worked days. We don't really need to test these here.
            contract.generate_work_entries(payslip_date, payslip_end_date)
            hours_per_day = contract.resource_calendar_id.hours_per_day
            work_hours = contract.get_work_hours(payslip_date, payslip_end_date).get(self.work_entry_types['WORK100'].id)
            work_days = self.env['hr.payslip']._round_days(self.work_entry_types['WORK100'], round(work_hours / hours_per_day, 5) if hours_per_day else 0)

            self._test_payslip(
                employee,
                contract,
                expected_worked_days=[
                    # (work_entry_type_id.id, number_of_day, number_of_hours, amount)
                    (self.work_entry_types['WORK100'].id, work_days, work_hours, 18000),
                ],
                expected_lines=[
                    # (code, total)
                    ('BASIC', 18000),
                    ('OTE', 18000),
                    ('GROSS', 18000),
                    ('WITHHOLD', expected_withholding[month]),
                    ('WITHHOLD.TOTAL', expected_withholding[month]),
                    ('NET', 18000 + expected_withholding[month]),
                    ('SUPER', 1980),
                ],
                payslip_date_from=payslip_date,
                payslip_date_to=payslip_end_date,
            )
