# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date

from odoo.tests.common import tagged
from odoo.addons.account.tests.common import AccountTestInvoicingCommon


@tagged('post_install', 'post_install_l10n', '-at_install', 'payslips_validation')
class TestPayslipValidation(AccountTestInvoicingCommon):

    @classmethod
    @AccountTestInvoicingCommon.setup_country('sa')
    def setUpClass(cls):
        super().setUpClass()

        cls.saudi_work_contact = cls.env['res.partner'].create({
            'name': 'KSA Local Employee',
            'company_id': cls.env.company.id,
        })
        cls.expat_work_contact = cls.env['res.partner'].create({
            'name': 'KSA Expat Employee',
            'company_id': cls.env.company.id,
        })

        cls.saudi_employee = cls.env['hr.employee'].create({
            'name': 'KSA Local Employee',
            'address_id': cls.saudi_work_contact.id,
            'company_id': cls.env.company.id,
            'country_id': cls.env.ref('base.sa').id,
        })

        cls.expat_employee = cls.env['hr.employee'].create({
            'name': 'KSA Expat Employee',
            'address_id': cls.expat_work_contact.id,
            'company_id': cls.env.company.id,
            'country_id': cls.env.ref('base.in').id,  # any other nationality
        })

        cls.saudi_contract = cls.env['hr.contract'].create({
            'name': "KSA Local Employee's contract",
            'employee_id': cls.saudi_employee.id,
            'company_id': cls.env.company.id,
            'structure_type_id': cls.env.ref('l10n_sa_hr_payroll.ksa_employee_payroll_structure_type').id,
            'date_start': date(2024, 1, 1),
            'wage': 12_000,
            'l10n_sa_housing_allowance': 1_000,
            'l10n_sa_transportation_allowance': 200,
            'l10n_sa_other_allowances': 500,
            'l10n_sa_number_of_days': 21,
            'state': "open",
        })

        cls.expat_contract = cls.env['hr.contract'].create({
            'name': "KSA Expat Employee's contract",
            'employee_id': cls.expat_employee.id,
            'company_id': cls.env.company.id,
            'structure_type_id': cls.env.ref('l10n_sa_hr_payroll.ksa_employee_payroll_structure_type').id,
            'date_start': date(2024, 1, 1),
            'wage': 5_000,
            'l10n_sa_housing_allowance': 1_000,
            'l10n_sa_transportation_allowance': 200,
            'l10n_sa_other_allowances': 300,
            'l10n_sa_number_of_days': 21,
            'state': "open",
        })

        cls.compensable_timeoff_type = cls.env['hr.leave.type'].create({
            'name': "KSA Compensable Leaves",
            'company_id': cls.env.company.id,
            'l10n_sa_is_compensable': True
        })

        cls.env['hr.leave.allocation'].create({
            'employee_id': cls.saudi_employee.id,
            'date_from': date(2024, 1, 1),
            'holiday_status_id': cls.compensable_timeoff_type.id,
            'number_of_days': 25,
            'state': 'confirm',
        }).action_validate()

    @classmethod
    def _lay_off_employee(cls, saudi_or_expat='saudi', reason=None):
        employee = cls.saudi_employee if saudi_or_expat == 'saudi' else cls.expat_employee
        employee.write({
            'active': False,
            'departure_reason_id': reason,
            'departure_date': date(2024, 3, 31)
        })
        (cls.saudi_contract if saudi_or_expat == 'saudi' else cls.expat_contract).date_end = date(2024, 3, 31)

    @classmethod
    def _generate_payslip(cls, date_from, date_to, saudi_or_expat='saudi'):
        if saudi_or_expat == 'saudi':
            employee = cls.saudi_employee
            contract = cls.saudi_contract
            struct = cls.env.ref('l10n_sa_hr_payroll.ksa_saudi_employee_payroll_structure')
        else:
            employee = cls.expat_employee
            contract = cls.expat_contract
            struct = cls.env.ref('l10n_sa_hr_payroll.ksa_expat_employee_payroll_structure')
        work_entries = contract.generate_work_entries(date_from, date_to)
        payslip = cls.env['hr.payslip'].create([{
            'name': "Test Payslip",
            'employee_id': employee.id,
            'contract_id': contract.id,
            'company_id': cls.env.company.id,
            'struct_id': struct.id,
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
            if payslip.currency_id.compare_amounts(payslip_line_value, value):
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

    def test_saudi_payslip(self):
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31), 'saudi')
        payslip_results = {
            'BASIC': 12000.0,
            'GOSI_COMP': -1527.5,
            'GOSI_EMP': -1267.5,
            'HOUALLOW': 1000.0,
            'OTALLOW': 500.0,
            'TRAALLOW': 200.0,
            'EOSP': 799.17,
            'GROSS': 13700.0,
            'NET': 12432.5,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_expat_payslip(self):
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31), 'expat')
        payslip_results = {
            'BASIC': 5000.0,
            'GOSI_COMP': -120.0,
            'HOUALLOW': 1000.0,
            'OTALLOW': 300.0,
            'TRAALLOW': 200.0,
            'EOSP': 379.17,
            'GROSS': 6500.0,
            'NET': 6500.0,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_saudi_payslip_laid_off(self):
        self._lay_off_employee('saudi', self.env.ref('l10n_sa_hr_payroll.saudi_departure_clause_77').id)
        payslip = self._generate_payslip(date(2024, 3, 1), date(2024, 3, 31), 'saudi')
        payslip_results = {
            'BASIC': 12000.0,
            'GOSI_COMP': -1527.5,
            'GOSI_EMP': -1267.5,
            'HOUALLOW': 1000.0,
            'OTALLOW': 500.0,
            'TRAALLOW': 200.0,
            'EOSALLOW': 27400.0,
            'EOSB': 13700.0,
            'ANNUALCOMP': 11416.67,
            'GROSS': 54800.0,
            'NET': 53532.5,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_expat_payslip_laid_off(self):
        self._lay_off_employee('expat', self.env.ref('l10n_sa_hr_payroll.saudi_departure_end_of_contract').id)
        payslip = self._generate_payslip(date(2024, 3, 1), date(2024, 3, 31), 'expat')
        payslip_results = {
            'BASIC': 5000.0,
            'GOSI_COMP': -120.0,
            'HOUALLOW': 1000.0,
            'OTALLOW': 300.0,
            'TRAALLOW': 200.0,
            'EOSB': 812.5,
            'GROSS': 7312.5,
            'NET': 7312.5,
        }
        self._validate_payslip(payslip, payslip_results)
