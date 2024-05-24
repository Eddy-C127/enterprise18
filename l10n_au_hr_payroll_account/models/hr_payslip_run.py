# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _
from odoo.exceptions import RedirectWarning, UserError


class HrPayslipRun(models.Model):
    _inherit = "hr.payslip.run"

    l10n_au_payment_batch_id = fields.Many2one(
        'account.batch.payment', string='Payment Batch', readonly=True, copy=False
    )
    l10n_au_payment_batch_state = fields.Selection(related='l10n_au_payment_batch_id.state', tracking=False)

    def action_register_payment(self):
        self.ensure_one()
        if not self.slip_ids.struct_id.rule_ids.filtered(lambda r: r.code == "NET").account_credit.reconcile:
            raise UserError(_('The credit account on the NET salary rule is not reconciliable'))

        faulty_bank_accounts = self.slip_ids.employee_id.sudo().bank_account_id.filtered(lambda b: not b.allow_out_payment)
        if faulty_bank_accounts:
            raise RedirectWarning(
                message=_('Bank account(s) for the following employee(s) are not allowed for outgoing payments!\n%s',
                          '\n'.join(faulty_bank_accounts.partner_id.mapped('name'))),
                action=faulty_bank_accounts._get_records_action(),
                button_text=_('Configure Employee Bank Account'),
            )

        clearing_house = self.env.ref('l10n_au_hr_payroll_account.res_partner_clearing_house', raise_if_not_found=False)
        if not clearing_house:
            raise UserError(_("No clearing house record found for this company!"))
        super_account = clearing_house.property_account_payable_id

        bank_journal = self.env['account.journal'].search([('type', '=', 'bank')], limit=1)
        aba_payment_method = bank_journal.outbound_payment_method_line_ids.filtered(lambda l: l.code == 'aba_ct')

        res = self.slip_ids.move_id.line_ids.filtered(lambda line: line.account_id != super_account)\
            .action_register_payment()
        res['context'].update({"default_payment_method_line_id": aba_payment_method.id})
        return res

    def action_open_payment_batch(self):
        return self.l10n_au_payment_batch_id._get_records_action()

    def action_post(self):
        self.slip_ids.move_id.action_post()

    def action_payment_report(self, export_format='aba'):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'hr.payroll.payment.report.wizard',
            'view_mode': 'form',
            'view_id': 'hr_payslip_payment_report_view_form',
            'views': [(False, 'form')],
            'target': 'new',
            'context': {
                'default_payslip_ids': self.slip_ids.ids,
                'default_payslip_run_id': self.id,
                'default_export_format': export_format,
            },
        }
