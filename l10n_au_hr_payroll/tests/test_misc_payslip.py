# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import date

from odoo.tests import tagged
from odoo.exceptions import UserError

from .common import TestPayrollCommon


@tagged("post_install_l10n", "post_install", "-at_install", "l10n_au_hr_payroll")
class TestPayrollMisc(TestPayrollCommon):

    def test_misc_payslip_1(self):
        self.tax_treatment_category = 'F'
        employee, contract = self._create_employee(contract_info={
            'employee': 'Naruto Uzumaki',
            'employment_basis_code': 'F',
            'tfn_declaration': 'provided',
            'tfn': '123456789',
            'salary_sacrifice_superannuation': 200,
            'salary_sacrifice_other': 100,
            'workplace_giving_employee': 50,
            'workplace_giving_employer': 50,
            'wage_type': 'monthly',
            'wage': 5000,
            'casual_loading': 0,
            'l10n_au_training_loan': True,
            'l10n_au_tax_free_threshold': False,
            'non_resident': True})

        self.assertEqual(employee.l10n_au_tax_treatment_code, 'FFSXXX')

        self._test_payslip(
            employee,
            contract,
            expected_worked_days=[
                # (work_entry_type_id.id, number_of_day, number_of_hours, amount)
                (self.work_entry_types['WORK100'].id, 23, 174.8, 5000),
            ],
            expected_lines=[
                # (code, total)
                ('BASIC', 5000),
                ('OTE', 6050),
                ('EXTRA', 200),
                ('SALARY.SACRIFICE.TOTAL', -350),
                ('ALW', 550),
                ('ALW.TAXFREE', 0),
                ('RTW', 300),
                ('SALARY.SACRIFICE.OTHER', -150),
                ('WORKPLACE.GIVING', -50),
                ('GROSS', 5650),
                ('WITHHOLD', -1603),
                ('RTW.WITHHOLD', -96),
                ('WITHHOLD.STUDY', -143),
                ('WITHHOLD.TOTAL', -1842),
                ('NET', 3808),
                ('SUPER.CONTRIBUTION', 200),
                ('SUPER', 695.75),
            ],
            input_lines=self.default_input_lines,
            payslip_date_from=date(2024, 7, 1),
            payslip_date_to=date(2024, 7, 31),
        )

    def test_misc_payslip_2(self):
        self.tax_treatment_category = 'F'
        employee, contract = self._create_employee(contract_info={
            'employee': 'Muhammad Ali',
            'employment_basis_code': 'F',
            'tfn_declaration': '111111111',
            'salary_sacrifice_superannuation': 200,
            'salary_sacrifice_other': 100,
            'workplace_giving_employee': 50,
            'workplace_giving_employer': 50,
            'wage_type': 'monthly',
            'wage': 5000,
            'casual_loading': 0,
            'l10n_au_training_loan': False,
            'l10n_au_tax_free_threshold': False,
            'non_resident': True})

        self.assertEqual(employee.l10n_au_tax_treatment_code, 'FFXXXX')

        self._test_payslip(
            employee,
            contract,
            expected_worked_days=[
                # (work_entry_type_id.id, number_of_day, number_of_hours, amount)
                (self.work_entry_types['WORK100'].id, 23, 174.8, 5000),
            ],
            expected_lines=[
                # (code, total)
                ('BASIC', 5000),
                ('OTE', 6050),
                ('EXTRA', 200),
                ('SALARY.SACRIFICE.TOTAL', -350),
                ('ALW', 550),
                ('ALW.TAXFREE', 0),
                ('RTW', 300),
                ('SALARY.SACRIFICE.OTHER', -150),
                ('WORKPLACE.GIVING', -50),
                ('GROSS', 5650),
                ('WITHHOLD', -1603),
                ('RTW.WITHHOLD', -96),
                ('WITHHOLD.TOTAL', -1699),
                ('NET', 3951),
                ('SUPER.CONTRIBUTION', 200),
                ('SUPER', 695.75),
            ],
            input_lines=self.default_input_lines,
            payslip_date_from=date(2024, 7, 1),
            payslip_date_to=date(2024, 7, 31),
        )

    def test_misc_payslip_3(self):
        self.tax_treatment_category = 'N'
        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'F',
            'tfn_declaration': '000000000',
            'salary_sacrifice_superannuation': 200,
            'salary_sacrifice_other': 100,
            'workplace_giving_employee': 50,
            'workplace_giving_employer': 50,
            'wage_type': 'monthly',
            'wage': 5000,
            'casual_loading': 0,
            'l10n_au_training_loan': False,
            'l10n_au_tax_free_threshold': False,
            'income_stream_type': 'SAW',
            'non_resident': True})

        self.assertEqual(employee.l10n_au_tax_treatment_code, 'NFXXXX')

        self._test_payslip(
            employee,
            contract,
            expected_worked_days=[
                # (work_entry_type_id.id, number_of_day, number_of_hours, amount)
                (self.work_entry_types['WORK100'].id, 23, 174.8, 5000),
            ],
            expected_lines=[
                # (code, total)
                ('BASIC', 5000),
                ('OTE', 6050),
                ('EXTRA', 200),
                ('SALARY.SACRIFICE.TOTAL', -350),
                ('ALW', 550),
                ('ALW.TAXFREE', 0),
                ('RTW', 300),
                ('SALARY.SACRIFICE.OTHER', -150),
                ('WORKPLACE.GIVING', -50),
                ('GROSS', 5650),
                ('WITHHOLD', -2407),
                ('RTW.WITHHOLD', -135),
                ('WITHHOLD.TOTAL', -2542),
                ('NET', 3108),
                ('SUPER.CONTRIBUTION', 200),
                ('SUPER', 695.75),
            ],
            input_lines=self.default_input_lines,
            payslip_date_from=date(2024, 7, 1),
            payslip_date_to=date(2024, 7, 31),
        )

    def test_misc_payslip_4(self):
        self.tax_treatment_category = 'N'
        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'F',
            'tfn_declaration': '000000000',
            'salary_sacrifice_superannuation': 200,
            'salary_sacrifice_other': 100,
            'workplace_giving_employee': 50,
            'workplace_giving_employer': 50,
            'wage_type': 'monthly',
            'wage': 5000,
            'casual_loading': 0,
            'l10n_au_training_loan': False,
            'l10n_au_tax_free_threshold': False,
            'income_stream_type': 'SAW',
            'non_resident': False})

        self.assertEqual(employee.l10n_au_tax_treatment_code, 'NAXXXX')

        self._test_payslip(
            employee,
            contract,
            expected_worked_days=[
                # (work_entry_type_id.id, number_of_day, number_of_hours, amount)
                (self.work_entry_types['WORK100'].id, 23, 174.8, 5000),
            ],
            expected_lines=[
                # (code, total)
                ('BASIC', 5000),
                ('OTE', 6050),
                ('EXTRA', 200),
                ('SALARY.SACRIFICE.TOTAL', -350),
                ('ALW', 550),
                ('ALW.TAXFREE', 0),
                ('RTW', 300),
                ('SALARY.SACRIFICE.OTHER', -150),
                ('WORKPLACE.GIVING', -50),
                ('GROSS', 5650),
                ('WITHHOLD', -2514.5),
                ('RTW.WITHHOLD', -141),
                ('WITHHOLD.TOTAL', -2655.5),
                ('NET', 2994.5),
                ('SUPER.CONTRIBUTION', 200),
                ('SUPER', 695.75),
            ],
            input_lines=self.default_input_lines,
            payslip_date_from=date(2024, 7, 1),
            payslip_date_to=date(2024, 7, 31),
        )

    def test_misc_payslip_5(self):
        self.tax_treatment_category = 'D'
        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'D',
            'tfn_declaration': 'provided',
            'tfn': '123456789',
            'salary_sacrifice_superannuation': 200,
            'salary_sacrifice_other': 100,
            'workplace_giving_employee': 50,
            'workplace_giving_employer': 50,
            'wage_type': 'monthly',
            'wage': 5000,
            'casual_loading': 0,
            'l10n_au_training_loan': False,
            'l10n_au_tax_free_threshold': False,
            'income_stream_type': 'SAW',
            'non_resident': False})

        self.assertEqual(employee.l10n_au_tax_treatment_code, 'DBXXXX')
        # ATO Defined should raise error
        with self.assertRaises(UserError):
            self._test_payslip(
                employee,
                contract,
                expected_worked_days=[
                    # (work_entry_type_id.id, number_of_day, number_of_hours, amount)
                    (self.work_entry_types['WORK100'].id, 23, 174.8, 5000),
                ],
                expected_lines=[
                    # (code, total)
                    ('BASIC', 5000),
                    ('OTE', 6050),
                    ('EXTRA', 200),
                    ('SALARY.SACRIFICE.TOTAL', -350),
                    ('ALW', 550),
                    ('ALW.TAXFREE', 0),
                    ('RTW', 300),
                    ('SALARY.SACRIFICE.OTHER', -150),
                    ('WORKPLACE.GIVING', -50),
                    ('GROSS', 5650),
                    ('WITHHOLD', -2514.5),
                    ('RTW.WITHHOLD', -141),
                    ('WITHHOLD.TOTAL', -2655.5),
                    ('NET', 2994.5),
                    ('SUPER.CONTRIBUTION', 200),
                    ('SUPER', 695.75),
                ],
                input_lines=self.default_input_lines,
                payslip_date_from=date(2024, 7, 1),
                payslip_date_to=date(2024, 7, 31),
            )

    def test_misc_payslip_6(self):
        self.tax_treatment_category = 'D'

    def test_misc_payslip_7(self):
        self.tax_treatment_category = 'D'

    def test_misc_payslip_8(self):
        self.tax_treatment_category = 'V'

        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'F',
            'tfn_declaration': 'provided',
            'tfn': '123456789',
            'salary_sacrifice_superannuation': 200,
            'salary_sacrifice_other': 100,
            'workplace_giving_employee': 50,
            'workplace_giving_employer': 50,
            'wage_type': 'monthly',
            'wage': 5000,
            'casual_loading': 0,
            'tax_treatment_option_voluntary': 'C',
            'l10n_au_training_loan': False,
            'l10n_au_tax_free_threshold': False,
            'income_stream_type': 'VOL',
            'comissioners_installment_rate': 50,
            'non_resident': False})

        self.assertEqual(employee.l10n_au_tax_treatment_code, 'VCXXXX')

        self._test_payslip(
            employee,
            contract,
            expected_worked_days=[
                # (work_entry_type_id.id, number_of_day, number_of_hours, amount)
                (self.work_entry_types['WORK100'].id, 23, 174.8, 5000),
            ],
            expected_lines=[
                # (code, total)
                ('BASIC', 5000),
                ('OTE', 6050),
                ('EXTRA', 200),
                ('SALARY.SACRIFICE.TOTAL', -350),
                ('ALW', 550),
                ('ALW.TAXFREE', 0),
                ('RTW', 300),
                ('SALARY.SACRIFICE.OTHER', -150),
                ('WORKPLACE.GIVING', -50),
                ('GROSS', 5650),
                ('WITHHOLD', -2825),
                ('WITHHOLD.TOTAL', -2825),
                ('NET', 2825),
                ('SUPER.CONTRIBUTION', 200),
                ('SUPER', 695.75),
            ],
            input_lines=self.default_input_lines,
            payslip_date_from=date(2024, 7, 1),
            payslip_date_to=date(2024, 7, 31),
        )

    def test_misc_payslip_9(self):
        self.tax_treatment_category = 'V'

        employee, contract = self._create_employee(contract_info={
            'employee': 'Test Employee',
            'employment_basis_code': 'F',
            'tfn_declaration': 'provided',
            'tfn': '123456789',
            'salary_sacrifice_superannuation': 200,
            'salary_sacrifice_other': 100,
            'workplace_giving_employee': 50,
            'workplace_giving_employer': 50,
            'wage_type': 'monthly',
            'wage': 5000,
            'casual_loading': 0,
            'tax_treatment_option_voluntary': 'O',
            'l10n_au_training_loan': False,
            'l10n_au_tax_free_threshold': False,
            'income_stream_type': 'VOL',
            'non_resident': False})

        self.assertEqual(employee.l10n_au_tax_treatment_code, 'VOXXXX')

        self._test_payslip(
            employee,
            contract,
            expected_worked_days=[
                # (work_entry_type_id.id, number_of_day, number_of_hours, amount)
                (self.work_entry_types['WORK100'].id, 23, 174.8, 5000),
            ],
            expected_lines=[
                # (code, total)
                ('BASIC', 5000),
                ('OTE', 6050),
                ('EXTRA', 200),
                ('SALARY.SACRIFICE.TOTAL', -350),
                ('ALW', 550),
                ('ALW.TAXFREE', 0),
                ('RTW', 300),
                ('SALARY.SACRIFICE.OTHER', -150),
                ('WORKPLACE.GIVING', -50),
                ('GROSS', 5650),
                ('WITHHOLD', -1130),
                ('WITHHOLD.TOTAL', -1130),
                ('NET', 4520),
                ('SUPER.CONTRIBUTION', 200),
                ('SUPER', 695.75),
            ],
            input_lines=self.default_input_lines,
            payslip_date_from=date(2024, 7, 1),
            payslip_date_to=date(2024, 7, 31),
        )
