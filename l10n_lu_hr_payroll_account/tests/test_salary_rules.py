# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date

from odoo.tests.common import tagged
from odoo.addons.hr_payroll_account.tests.common import TestPayslipValidationCommon


@tagged('post_install', 'post_install_l10n', '-at_install', 'payslips_validation')
class TestPayslipValidation(TestPayslipValidationCommon):

    @classmethod
    @TestPayslipValidationCommon.setup_country('lu')
    def setUpClass(cls):
        super().setUpClass()
        cls._setup_common(
            country=cls.env.ref('base.lu'),
            structure=cls.env.ref('l10n_lu_hr_payroll.hr_payroll_structure_lux_employee_salary'),
            structure_type=cls.env.ref('l10n_lu_hr_payroll.structure_type_employee_lux'),
            contract_fields={
                'wage': 4000,
                'l10n_lu_meal_voucher_amount': 50.4,
            }
        )

    def test_basic_payslip_1(self):
        self.contract.wage = 1000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {'BASIC': 1000.0, 'BIK_TRANSPORT_NO_VAT': 0.0, 'VPA': 0.0, 'BIK_TRANSPORT_VAT': 0.0, 'COTISATION_BASE': 1000.0, 'MEAL_VOUCHERS': 50.4, 'GROSS': 1050.4, 'HEALTH_FUND': -28.0, 'RETIREMENT_FUND': -80.0, 'SICK_FUND': -2.5, 'DED_TOTAL': -110.5, 'TRANS_FEES': 0.0, 'TAXABLE': 939.9, 'TAXES': 0.0, 'CIS': 50.0, 'CI_CO2': 14.0, 'CISSM': 0.0, 'TOTAL_TAX_CREDIT': 0.0, 'DEP_INS': -5.0, 'NET': 934.9, 'MEAL_VOUCHERS.2': -50.4, 'BIK_TRANSPORT_NO_VAT.2': 0.0, 'BIK_TRANSPORT_VAT.2': 0.0, 'BIK_VARIOUS.2': 0.0, 'NET_TO_PAY': 884.5}
        self._validate_payslip(payslip, payslip_results)

    def test_basic_payslip_2(self):
        self.contract.wage = 2000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {'BASIC': 2000.0, 'BIK_TRANSPORT_NO_VAT': 0.0, 'VPA': 0.0, 'BIK_TRANSPORT_VAT': 0.0, 'COTISATION_BASE': 2000.0, 'MEAL_VOUCHERS': 50.4, 'GROSS': 2050.4, 'HEALTH_FUND': -56.0, 'RETIREMENT_FUND': -160.0, 'SICK_FUND': -5.0, 'DED_TOTAL': -221.0, 'TRANS_FEES': 0.0, 'TAXABLE': 1829.4, 'TAXES': -71.7, 'CIS': 50.0, 'CI_CO2': 14.0, 'CISSM': 70.0, 'TOTAL_TAX_CREDIT': 71.7, 'DEP_INS': -19.0, 'NET': 1810.4, 'MEAL_VOUCHERS.2': -50.4, 'BIK_TRANSPORT_NO_VAT.2': 0.0, 'BIK_TRANSPORT_VAT.2': 0.0, 'BIK_VARIOUS.2': 0.0, 'NET_TO_PAY': 1760.0}
        self._validate_payslip(payslip, payslip_results)

    def test_basic_payslip_3(self):
        self.contract.wage = 3000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {'BASIC': 3000.0, 'BIK_TRANSPORT_NO_VAT': 0.0, 'VPA': 0.0, 'BIK_TRANSPORT_VAT': 0.0, 'COTISATION_BASE': 3000.0, 'MEAL_VOUCHERS': 50.4, 'GROSS': 3050.4, 'HEALTH_FUND': -84.0, 'RETIREMENT_FUND': -240.0, 'SICK_FUND': -7.5, 'DED_TOTAL': -331.5, 'TRANS_FEES': 0.0, 'TAXABLE': 2718.9, 'TAXES': -225.9, 'CIS': 50.0, 'CI_CO2': 14.0, 'CISSM': 64.17, 'TOTAL_TAX_CREDIT': 128.17, 'DEP_INS': -33.0, 'NET': 2588.16, 'MEAL_VOUCHERS.2': -50.4, 'BIK_TRANSPORT_NO_VAT.2': 0.0, 'BIK_TRANSPORT_VAT.2': 0.0, 'BIK_VARIOUS.2': 0.0, 'NET_TO_PAY': 2537.76}
        self._validate_payslip(payslip, payslip_results)

    def test_basic_payslip_4(self):
        self.contract.wage = 3500.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {'BASIC': 3500.0, 'BIK_TRANSPORT_NO_VAT': 0.0, 'VPA': 0.0, 'BIK_TRANSPORT_VAT': 0.0, 'COTISATION_BASE': 3500.0, 'MEAL_VOUCHERS': 50.4, 'GROSS': 3550.4, 'HEALTH_FUND': -98.0, 'RETIREMENT_FUND': -280.0, 'SICK_FUND': -8.75, 'DED_TOTAL': -386.75, 'TRANS_FEES': 0.0, 'TAXABLE': 3163.65, 'TAXES': -338.8, 'CIS': 46.75, 'CI_CO2': 13.09, 'CISSM': 5.83, 'TOTAL_TAX_CREDIT': 65.67, 'DEP_INS': -40.0, 'NET': 2850.52, 'MEAL_VOUCHERS.2': -50.4, 'BIK_TRANSPORT_NO_VAT.2': 0.0, 'BIK_TRANSPORT_VAT.2': 0.0, 'BIK_VARIOUS.2': 0.0, 'NET_TO_PAY': 2800.12}
        self._validate_payslip(payslip, payslip_results)

    def test_basic_payslip_5(self):
        self.contract.wage = 4000.0
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {'BASIC': 4000.0, 'BIK_TRANSPORT_NO_VAT': 0.0, 'VPA': 0.0, 'BIK_TRANSPORT_VAT': 0.0, 'COTISATION_BASE': 4000.0, 'MEAL_VOUCHERS': 50.4, 'GROSS': 4050.4, 'HEALTH_FUND': -112.0, 'RETIREMENT_FUND': -320.0, 'SICK_FUND': -10.0, 'DED_TOTAL': -442.0, 'TRANS_FEES': 0.0, 'TAXABLE': 3608.4, 'TAXES': -474.6, 'CIS': 39.25, 'CI_CO2': 10.99, 'CISSM': 0.0, 'TOTAL_TAX_CREDIT': 50.23, 'DEP_INS': -47.0, 'NET': 3137.03, 'MEAL_VOUCHERS.2': -50.4, 'BIK_TRANSPORT_NO_VAT.2': 0.0, 'BIK_TRANSPORT_VAT.2': 0.0, 'BIK_VARIOUS.2': 0.0, 'NET_TO_PAY': 3086.63}
        self._validate_payslip(payslip, payslip_results)

    def test_gratification_payslip(self):
        self.employee.departure_date = date(2024, 1, 31)
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        self._add_other_inputs(payslip, {
            'l10n_lu_hr_payroll.input_gratification_lu': 2000,
        })
        payslip_results = {'BASIC': 4000.0, 'BIK_TRANSPORT_NO_VAT': 0.0, 'VPA': 0.0, 'BIK_TRANSPORT_VAT': 0.0, 'COTISATION_BASE': 4000.0, 'MEAL_VOUCHERS': 50.4, 'GROSS': 4050.4, 'HEALTH_FUND': -112.0, 'RETIREMENT_FUND': -320.0, 'SICK_FUND': -10.0, 'DED_TOTAL': -442.0, 'TRANS_FEES': 0.0, 'TAXABLE': 3608.4, 'TAXES': -474.6, 'CIS': 39.25, 'CI_CO2': 10.99, 'CISSM': 0.0, 'TOTAL_TAX_CREDIT': 50.23, 'DEP_INS': -47.0, 'BASIC_GRATIFICATION': 2000.0, 'GRAT_HEALTH_FUND': -56.0, 'GRAT_RETIREMENT_FUND': -160.0, 'GROSS_GRATIFICATION': 1780.0, 'TAX_ON_NON_PERIOD_REVENUE': -685.3, 'NET_GRATIFICATION': 1094.7, 'NET': 4231.73, 'MEAL_VOUCHERS.2': -50.4, 'BIK_TRANSPORT_NO_VAT.2': 0.0, 'BIK_TRANSPORT_VAT.2': 0.0, 'BIK_VARIOUS.2': 0.0, 'NET_TO_PAY': 4181.33}
        self._validate_payslip(payslip, payslip_results)
