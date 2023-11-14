# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, _
from odoo.exceptions import AccessError, UserError
from odoo.tools import frozendict


class AccountMove(models.Model):
    _inherit = 'account.move'

    def _post(self, soft=True):
        # EXTENDS account
        res = super()._post(soft=soft)
        self._hr_payroll_expense_create_reconcile_linked_expense_move()
        return res

    def unlink(self):
        # EXTENDS account
        self.payslip_ids.expense_sheet_ids.account_move_ids._unlink_or_reverse()
        return super().unlink()

    def button_draft(self):
        # When a payslip move is reset to draft, we need to delete or reverse the expense move.
        # We cannot use self.env['account.move']._unlink_or_reverse() because we need to override some values in the case of a reversal.
        # This would also create an infinite recursion loop between `_unlink_or_reverse` and `button_draft`
        # EXTENDS account
        res = super().button_draft()
        expense_moves = self.payslip_ids.expense_sheet_ids.account_move_ids
        to_reverse = self.env['account.move']
        to_unlink = self.env['account.move']
        lock_dates_per_company = {company: company._get_user_fiscal_lock_date() for company in expense_moves.company_id}
        for move in expense_moves:
            if move.inalterable_hash or move.date <= lock_dates_per_company[move.company_id]:
                to_reverse |= move
            else:
                to_unlink |= move
        to_reverse._reverse_moves(
            default_values_list=[{'invoice_date': fields.Date.context_today(move), 'ref': False} for move in to_reverse],
            cancel=True
        )
        super(AccountMove, to_unlink.filtered(lambda m: m.state in ('posted', 'cancel'))).button_draft()
        to_unlink.filtered(lambda m: m.state == 'draft').unlink()
        return res

    def _compute_needed_terms(self):
        # We want to set the account destination based on the 'payment_mode' if you have a payslip linked.
        # If the expense is reimbursed to the employee through the payslip,
        # we need to set the account destination to the debit account of the salary rule 'EXPENSES'.
        # For this, we need to find the accounts that will be used to record the expense on the employee payslip move.
        # EXTENDS hr_expense
        super()._compute_needed_terms()
        for move in self.filtered(lambda move: move.expense_sheet_id.payslip_id and move.expense_sheet_id.payment_mode == 'own_account'):
            expense_rule = (
                move.expense_sheet_id.payslip_id.struct_id.rule_ids.with_company(move.company_id)
                .filtered(lambda rule: rule.code == 'EXPENSES')
            )
            account = expense_rule.account_debit
            if not account:
                raise UserError(_(
                    "No debit account found in the '%(rule_name)s' payslip salary rule."
                    "Please add a payable debit account to be able to create an accounting entry for the expense report "
                    "'%(expense_report_name)s'.",
                    rule_name=expense_rule.name,
                    expense_report_name=move.expense_sheet_id.name,
                ))
            if account.account_type != 'liability_payable':
                raise UserError(_(
                    "The '%(account_name)s' account for the salary rule '%(rule_name)s' must be of type 'Payable'.",
                    account_name=account.name,
                    rule_name=expense_rule.name,
                ))

            other_lines = move.line_ids.filtered(lambda l: l.display_type != 'payment_term')
            move.needed_terms = {
                frozendict(
                    {
                        "move_id": move.id,
                        "date_maturity": move.expense_sheet_id.accounting_date or fields.Date.context_today(move.expense_sheet_id),
                    }
                ): {
                    "balance": -sum(other_lines.mapped("balance")),
                    "amount_currency": -sum(other_lines.mapped("amount_currency")),
                    "name": _(
                        "%(employee_name)s: %(expense_name)s",
                        employee_name=move.partner_id.name,
                        expense_name=move.expense_sheet_id.name,
                    ),
                    "account_id": account.id,
                }
            }

    def _hr_payroll_expense_create_reconcile_linked_expense_move(self):
        """
            Create the posted expense's move and reconcile it with the payslip move,
            as the expense is reimbursed to the employee through the payslip.
            This ensures the payment state of the expense, its report, and move are set to 'paid'.
        """
        if not self.env.is_superuser() and not self.env.user.has_group('account.group_account_invoice'):
            raise AccessError(_("You don't have the access rights to post an invoice."))

        for payslip_sudo in self.sudo().payslip_ids:
            expense_sheets_sudo = payslip_sudo.expense_sheet_ids.sorted(lambda sheet: sheet.accounting_date or fields.Date.context_today(sheet))
            expense_sheets_sudo._do_create_moves()
            payable_amls_sudo = expense_sheets_sudo.account_move_ids.line_ids.filtered(
                lambda line: line.account_id.account_type == 'liability_payable' and line.move_id.state == 'posted'
            )
            if not payable_amls_sudo:
                return  # No expense payable move move to reconcile

            payable_account_ids = set(payable_amls_sudo.account_id.ids)
            payslip_expense_reimbursement_amls_sudo = payslip_sudo.move_id.line_ids.filtered(
                lambda line: line.account_id.id in payable_account_ids and line.move_id.state == 'posted'
            )

            if payslip_expense_reimbursement_amls_sudo:
                (payable_amls_sudo | payslip_expense_reimbursement_amls_sudo).reconcile()
