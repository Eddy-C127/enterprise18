# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime

from dateutil.relativedelta import relativedelta
from freezegun import freeze_time

from odoo import Command
from odoo.addons.hr_expense.tests.common import TestExpenseCommon
from odoo.addons.hr_payroll_account.tests.test_hr_payroll_account import TestHrPayrollAccountCommon
from odoo.exceptions import UserError
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestPayrollExpense(TestExpenseCommon, TestHrPayrollAccountCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass()

        cls.payslip_run.company_id = cls.company_data['company'].id

        # Else the payslip_run will be using the the demo company in its environment, thus raising an error
        # when payslip_run.action_validate() is called. Because the demo company doesn't have a journal
        # and payslip_run.slip_ids.journal_id is company dependent
        cls.payslip_run.env = cls.env

        cls.expense_employee.update({
            'gender': 'male',
            'birthday': '1984-05-01',
            'company_id': cls.company_data['company'].id,
            'country_id': cls.company_data['company'].country_id.id,
            'department_id': cls.dep_rd.id,
        })
        cls.expense_contract = cls.env['hr.contract'].create({
            'date_end': cls.frozen_today + relativedelta(years=2),
            'date_start': cls.frozen_today - relativedelta(years=2),
            'name': 'Contract for expense employee',
            'wage': 5000.33,
            'employee_id': cls.expense_employee.id,
            'structure_type_id': cls.hr_structure_type.id,
            'state': 'open',
        })
        cls.expense_work_entry = cls.env['hr.work.entry'].create({
            'name': 'Work Entry',
            'employee_id': cls.expense_employee.id,
            'date_start': cls.frozen_today - relativedelta(days=1),
            'date_stop': cls.frozen_today,
            'contract_id': cls.expense_contract.id,
            'state': 'validated',
        })
        cls.expense_payslip_input = cls.env.ref('hr_payroll_expense.expense_other_input')
        expense_payslip_tax_account = cls.env['account.account'].create({
                'name': 'Rental Tax',
                'code': '777777',
                'account_type': 'asset_current',
                'company_id': cls.company_data['company'].id,
            })
        expense_tax = cls.env['account.tax'].create({
            'name': "Some taxes on normal payslip",
            'amount_type': 'percent',
            'amount': 10.0,
            'type_tax_use': 'sale',
            'company_id': cls.company_data['company'].id,
            'invoice_repartition_line_ids': [
                Command.create({'factor_percent': 100, 'repartition_type': 'base'}),
                Command.create({'factor_percent': 100, 'account_id': expense_payslip_tax_account.id}),
            ],
            'refund_repartition_line_ids': [
                Command.create({'factor_percent': 100, 'repartition_type': 'base'}),
                Command.create({'factor_percent': 100, 'account_id': expense_payslip_tax_account.id}),
            ],
        })
        test_account = cls.env['account.account'].create({
                'name': 'House Rental',
                'code': '654321',
                'account_type': 'income',
                'tax_ids': [Command.link(expense_tax.id)],
                'company_id': cls.company_data['company'].id,
        })
        cls.expense_payable_account = cls.env['account.account'].create({
                'name': 'payable',
                'code': '654323',
                'account_type': 'liability_payable',
                'company_id': cls.company_data['company'].id,
            })
        expense_payslip_journal = cls.account_journal.copy({
            'company_id': cls.company_data['company'].id,
            'default_account_id': cls.expense_payable_account.id
        })
        cls.expense_hr_structure = cls.env['hr.payroll.structure'].create({
            'name': 'Salary Structure for Software Developer',
            'journal_id': expense_payslip_journal.id,
            'rule_ids': [Command.create({
                'name': 'Basic Salary',
                'amount_select': 'code',
                'amount_python_compute': 'result = contract.wage',
                'code': 'BASIC',
                'category_id': cls.env.ref('hr_payroll.BASIC').id,
                'sequence': 1,
                'account_debit': test_account.id,
            }), Command.create({
                'name': 'House Rent Allowance',
                'amount_select': 'percentage',
                'amount_percentage': 40,
                'amount_percentage_base': 'contract.wage',
                'code': 'HRA',
                'category_id': cls.env.ref('hr_payroll.ALW').id,
                'sequence': 5,
                'account_debit': test_account.id,
            }), Command.create({
                'name': 'Reimbursed Expenses',
                'amount_select': 'code',
                'condition_python': 'result = "EXPENSES" in inputs and inputs["EXPENSES"].amount > 0.0',
                'amount_python_compute': 'result = inputs["EXPENSES"].amount if "EXPENSES" in inputs else 0',
                'code': 'EXPENSES',
                'category_id': cls.env.ref('hr_payroll.ALW').id,
                'sequence': 6,
                'account_debit': cls.expense_payable_account.id,
            }), Command.create({
                'name': 'Net Salary',
                'amount_select': 'code',
                'amount_python_compute': 'result = categories["BASIC"] + categories["ALW"] + categories["DED"]',
                'code': 'NET',
                'category_id': cls.env.ref('hr_payroll.NET').id,
                'sequence': 10,
                'account_credit': test_account.id,
            })],
            'type_id': cls.env['hr.payroll.structure.type'].create({'name': 'Employee', 'country_id': False}).id,
        })

    def test_main_flow_expense_in_payslip(self):
        # pylint: disable=bad-whitespace
        with freeze_time(self.frozen_today):
            sheet_1 = self.create_expense_report()
            sheet_2 = self.create_expense_report({
                'name': 'Test Expense Report 2',
                'expense_line_ids': [Command.create({
                    'name': 'Expense 2',
                    'employee_id': self.expense_employee.id,
                    'product_id': self.product_c.id,
                    'total_amount_currency': 3000,
                    'tax_ids': [Command.set(self.tax_sale_a.ids)],
                })],
            })
            sheets = sheet_1 | sheet_2
            sheets.action_submit_sheet()
            sheets.action_approve_expense_sheets()
            sheets.action_report_in_next_payslip()

            # Creating payslip links the expense sheet to the payslip
            payslip = self.env['hr.payslip'].create({
                'name': 'Payslip',
                'number': 'PAYSLIPTEST01',
                'employee_id': self.expense_employee.id,
                'struct_id': self.expense_hr_structure.id,
                'contract_id': self.expense_contract.id,
                'payslip_run_id': self.payslip_run.id,
                'date_from': self.frozen_today - relativedelta(months=1),
                'date_to': self.frozen_today,
                'company_id': self.company_data['company'].id,
            })
            self.assertRecordValues(sheets, [
                {'state': 'approve', 'payslip_id': payslip.id, 'payment_state': 'not_paid', 'account_move_ids': []},
                {'state': 'approve', 'payslip_id': payslip.id, 'payment_state': 'not_paid', 'account_move_ids': []},
            ])
            self.assertRecordValues(payslip, [
                {'expense_sheet_ids': sheets.ids, 'state': 'draft', 'employee_id': self.expense_employee.id},
            ])
            self.assertRecordValues(payslip.input_line_ids, [
                {'input_type_id': self.expense_payslip_input.id, 'amount': sum(sheets.mapped('total_amount'))},
            ])

            # Test removing expense from payslip unlinks the two
            sheet_1.action_remove_from_payslip()
            self.assertRecordValues(sheets, [
                {'name':   'Test Expense Report', 'state': 'approve', 'payslip_id':      False, 'payment_state': 'not_paid', 'account_move_ids': []},
                {'name': 'Test Expense Report 2', 'state': 'approve', 'payslip_id': payslip.id, 'payment_state': 'not_paid', 'account_move_ids': []},
            ])
            self.assertRecordValues(payslip, [
                {'expense_sheet_ids': sheet_2.ids, 'state': 'draft', 'employee_id': self.expense_employee.id},
            ])
            self.assertRecordValues(payslip.input_line_ids, [
                {'input_type_id': self.expense_payslip_input.id, 'amount': sheet_2.total_amount},
            ])

            sheet_2.action_remove_from_payslip()
            self.assertRecordValues(sheets, [
                {'state': 'approve', 'payslip_id': False, 'payment_state': 'not_paid', 'account_move_ids': []},
                {'state': 'approve', 'payslip_id': False, 'payment_state': 'not_paid', 'account_move_ids': []},
            ])
            self.assertRecordValues(payslip, [
                {'expense_sheet_ids': [], 'state': 'draft', 'employee_id': self.expense_employee.id},
            ])
            self.assertFalse(payslip.input_line_ids)

            # This should re-add the expense to the payslip
            sheets.action_report_in_next_payslip()
            payslip.action_payslip_draft()
            self.assertRecordValues(sheets, [
                {'state': 'approve', 'payslip_id': payslip.id, 'payment_state': 'not_paid', 'account_move_ids': []},
                {'state': 'approve', 'payslip_id': payslip.id, 'payment_state': 'not_paid', 'account_move_ids': []},
            ])

            # Moving up to setting the payslip as done shouldn't change anything for the expense
            self.payslip_run.slip_ids.compute_sheet()
            self.payslip_run.action_validate()
            self.assertRecordValues(sheets, [
                {'state': 'approve', 'payslip_id': payslip.id, 'payment_state': 'not_paid', 'account_move_ids': []},
                {'state': 'approve', 'payslip_id': payslip.id, 'payment_state': 'not_paid', 'account_move_ids': []},
            ])
            # Test trying to remove the expense sheet from the payslip when a payslip has generated a move raises an error
            with self.assertRaises(UserError):
                sheet_1.action_remove_from_payslip()
            with self.assertRaises(UserError):
                sheet_1.action_reset_expense_sheets()

            # Posting the payslip move should post the expense sheet moves
            payslip.move_id.action_post()
            self.assertEqual(1, len(sheet_1.account_move_ids), "Posting the payslip more should create the expense move")
            self.assertEqual(1, len(sheet_2.account_move_ids), "Posting the payslip more should create the expense move")
            self.assertRecordValues(sheets.account_move_ids.line_ids.filtered(lambda l: l.account_id.account_type == 'liability_payable'), [
                {'balance': -sheet_1.total_amount, 'account_id': self.expense_payable_account.id},
                {'balance': -sheet_2.total_amount, 'account_id': self.expense_payable_account.id},
            ])
            self.assertRecordValues(payslip.move_id.line_ids.filtered(lambda l: l.account_id.account_type == 'liability_payable'), [
                {'balance': sum(sheets.mapped('total_amount')), 'account_id': self.expense_payable_account.id},
            ])
            reconciled_lines = self.env['account.partial.reconcile'].search([
                ('debit_move_id', 'in', payslip.move_id.line_ids.ids),
                ('credit_move_id', 'in', sheets.account_move_ids.line_ids.ids),
            ])
            self.assertRecordValues(reconciled_lines.sorted('amount'), [
                {'amount': sheet_1.total_amount, 'credit_amount_currency': sheet_1.total_amount, 'debit_amount_currency': sheet_1.total_amount},
                {'amount': sheet_2.total_amount, 'credit_amount_currency': sheet_2.total_amount, 'debit_amount_currency': sheet_2.total_amount},
            ])

            # Test reversing the payslip move keeps the expense sheet linked to the payslip
            payslip.move_id.button_draft()
            payslip.move_id.unlink()
            self.assertRecordValues(sheets, [
                {'state': 'approve', 'payslip_id': payslip.id, 'payment_state': 'not_paid', 'account_move_ids': []},
                {'state': 'approve', 'payslip_id': payslip.id, 'payment_state': 'not_paid', 'account_move_ids': []},
            ])
            payslip.action_payslip_draft()
            payslip.unlink()
            self.assertRecordValues(sheets, [
                {'state': 'approve', 'payslip_id': False, 'payment_state': 'not_paid', 'account_move_ids': []},
                {'state': 'approve', 'payslip_id': False, 'payment_state': 'not_paid', 'account_move_ids': []},
            ])


    @freeze_time('2024-01-01')
    def test_corner_case_frozen_moves(self):
        """ Test that the expense-payroll flow doesn't break when a move is locked and can't be altered"""

        sheet = self.create_expense_report({'accounting_date': '2023-07-11'})

        sheet.action_submit_sheet()
        sheet.action_approve_expense_sheets()
        sheet.action_report_in_next_payslip()

        payslip = self.env['hr.payslip'].create({
                'name': 'Payslip',
                'number': 'PAYSLIPTEST01',
                'employee_id': self.expense_employee.id,
                'struct_id': self.expense_hr_structure.id,
                'contract_id': self.expense_contract.id,
                'payslip_run_id': self.payslip_run.id,
                'date_from': '2023-12-01',
                'date_to': '2023-12-31',
                'company_id': self.company_data['company'].id,
            })
        self.payslip_run.slip_ids.compute_sheet()
        self.payslip_run.action_validate()
        payslip.move_id.action_post()

        # Check the expense date
        self.assertRecordValues(sheet, [
            {'state': 'done', 'payslip_id': payslip.id, 'payment_state': 'paid', 'accounting_date': datetime.date.fromisoformat('2023-07-11')},
        ])
        self.env['account.change.lock.date'].create({'fiscalyear_lock_date': '2023-10-31'}).change_lock_date()  # After the expense sheet date
        sheet_original_move = sheet.account_move_ids
        payslip.move_id.button_draft()

        # A credit note should be emitted to revert the vendor bill
        self.assertRecordValues(sheet, [
            {'state': 'approve', 'payslip_id': payslip.id, 'payment_state': 'not_paid', 'account_move_ids': []},
        ])
        self.assertTrue(sheet_original_move.reversal_move_id)
