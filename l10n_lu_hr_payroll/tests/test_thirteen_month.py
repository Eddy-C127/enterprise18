from freezegun import freeze_time

from odoo.tests import tagged

from .common import TestLuPayrollCommon

@freeze_time('2024-01-01')
@tagged('post_install_l10n', 'post_install', '-at_install')
class TestLuMonthlyDeclaration(TestLuPayrollCommon):
    def setUp(self):
        super().setUp()

        self.payslip_david = self.env['hr.payslip'].create({
            'name': 'Payslip of David',
            'employee_id': self.employee_david.id,
            'struct_id': self.env.ref('l10n_lu_hr_payroll.hr_payroll_structure_lux_employee_thirteen_month').id,
        })

    def test_13_month_active(self):
        self.contract_david.l10n_lu_13th_month = False
        self.payslip_david.compute_sheet()
        self.assertEqual(self.payslip_david.basic_wage, 0.0)

        self.contract_david.l10n_lu_13th_month = True
        self.payslip_david.compute_sheet()
        self.assertEqual(self.payslip_david.basic_wage, self.contract_david.wage)

    def test_gratification_amount(self):
        self.contract_david.l10n_lu_13th_month = True
        self.contract_david.wage = 6000.0
        self.payslip_david.compute_sheet()
        self.assertEqual(self.payslip_david.basic_wage, 6000.0)
        self.assertEqual(self.payslip_david.gross_wage, 5350.0)
        self.assertEqual(self.payslip_david.net_wage, 3180.0)

        self.contract_david.wage = 3000.0
        self.payslip_david.compute_sheet()
        self.assertEqual(self.payslip_david.basic_wage, 3000.0)
        self.assertEqual(self.payslip_david.gross_wage, 2675.0)
        self.assertEqual(self.payslip_david.net_wage, 1952.8)
