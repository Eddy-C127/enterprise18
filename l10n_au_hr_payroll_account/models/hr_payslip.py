# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
from datetime import datetime

from odoo import api, fields, models, _
from odoo.exceptions import UserError, RedirectWarning


class HrPayslip(models.Model):
    _inherit = "hr.payslip"

    has_superstream = fields.Boolean(compute="_compute_has_superstream")

    @api.depends('state')
    def _compute_has_superstream(self):
        for rec in self:
            rec.has_superstream = bool(rec._get_superstreams())

    def _generate_aba_file(self, journal_id):
        bank_account = journal_id.bank_account_id
        if not bank_account:
            raise RedirectWarning(
                        message=_("The bank account on journal '%s' is not set. Please create a new account or set an existing one.", journal_id.name),
                        action=journal_id._get_records_action(name=_("Configure Journal"), target="new"),
                        button_text=_("Configure Journal Bank Account")
                    )
        if bank_account.acc_type != 'aba' or not bank_account.aba_bsb:
            raise RedirectWarning(
                message=_("The account %(account)s, of journal '%(journal)s', is not valid for ABA.\nEither its account number is incorrect or it has no BSB set.", account=bank_account.acc_number, journal=journal_id.name),
                action=bank_account._get_records_action(name=_("Configure Account"), target="new"),
                button_text=_("Configure Account")
            )
        if not journal_id.aba_fic or not journal_id.aba_user_spec or not journal_id.aba_user_number:
            raise RedirectWarning(
                        message=_("ABA fields for account '%(account)s', of journal '%(journal)s', are not set. Please set the fields under ABA section!", account=bank_account.acc_number, journal=journal_id.name),
                        action=journal_id._get_records_action(name=_("Configure Journal"), target="new"),
                        button_text=_("Configure Journal")
                    )
        # Redirect to employee as some accounts may be missing
        faulty_employee_accounts = self.env['hr.employee']
        for payslip in self:
            if payslip.employee_id.bank_account_id.acc_type != 'aba' or not payslip.employee_id.bank_account_id.aba_bsb:
                faulty_employee_accounts |= payslip.employee_id
            if not payslip.employee_id.bank_account_id.allow_out_payment:
                faulty_employee_accounts |= payslip.employee_id
        if faulty_employee_accounts:
            raise RedirectWarning(
                message=_("Bank accounts for the following Employees' maybe invalid or missing. Please ensure each employee has a valid"
                          "ABA account with a valid BSB or Account number and allow it to send money.\n %s",
                          "\n".join(faulty_employee_accounts.mapped("display_name"))),
                action=faulty_employee_accounts._get_records_action(name=_("Configure Employee Accounts")),
                button_text=_("Configure Employee Accounts")
            )
        filename_date = fields.Datetime.context_timestamp(self, datetime.now()).strftime("%Y%m%d%H%M")

        aba_date = fields.Date.context_today(self).strftime('%d%m%y')
        aba_values = {
            'aba_date': aba_date,
            'aba_description': 'PAYROLL',
            'self_balancing_reference': 'PAYROLL %s' % aba_date,
            'payments_data': [{
                'name': payslip.number,
                'amount': payslip.net_wage,
                'bank_account': payslip.employee_id.bank_account_id,
                'account_holder': payslip.employee_id,
                'transaction_code': 53,  # PAYROLL
                'reference': payslip.number,
            } for payslip in self]
        }

        export_file_data = {
            'filename': f'ABA-{journal_id.code}-{filename_date}.aba',
            'file': base64.encodebytes(self.env['account.batch.payment']._create_aba_document(journal_id, aba_values).encode()),
        }

        self.payslip_run_id.write({
            'l10n_au_export_aba_file': export_file_data['file'],
            'l10n_au_export_aba_filename': export_file_data['filename'],
        })

    def action_payslip_done(self):
        """
            Generate the superstream record for all australian payslips with
            superannuation salary rules.
        """
        super().action_payslip_done()
        self.filtered(lambda p: p.country_code == 'AU')._add_payslip_to_superstream()

    def _clear_super_stream_lines(self):
        to_delete = self.env["l10n_au.super.stream.line"].search([('payslip_id', 'in', self.ids)])
        to_delete.unlink()

    def action_payslip_cancel(self):
        self._clear_super_stream_lines()
        return super().action_payslip_cancel()

    def action_payslip_draft(self):
        self._clear_super_stream_lines()
        return super().action_payslip_draft()

    def _get_superstreams(self):
        return self.env["l10n_au.super.stream.line"].search([("payslip_id", "in", self.ids)]).l10n_au_super_stream_id

    def _add_payslip_to_superstream(self):
        if not self:
            return

        if not self.company_id.l10n_au_hr_super_responsible_id:
            raise UserError(_("This company does not have an employee responsible for managing SuperStream."
                              "You can set one in Payroll > Configuration > Settings."))

        # Get latest draft superstream, if any, else create new
        superstream = self.env['l10n_au.super.stream'].search([('state', '=', 'draft')], order='create_date desc', limit=1)
        if not superstream:
            superstream = self.env['l10n_au.super.stream'].create({})

        super_line_vals = []
        for payslip in self:
            if not payslip.line_ids.filtered(lambda line: line.code == "SUPER"):
                continue
            super_accounts = payslip.employee_id._get_active_super_accounts()

            if not super_accounts:
                raise UserError(_(
                    "No active super account found for the employee %s. "
                    "Please create a super account before proceeding",
                    payslip.employee_id.name))

            super_line_vals += [{
                "l10n_au_super_stream_id": superstream.id,
                "employee_id": payslip.employee_id.id,
                "payslip_id": payslip.id,
                "sender_id": payslip.company_id.l10n_au_hr_super_responsible_id.id,
                "super_account_id": account.id,
            } for account in super_accounts]

        return self.env["l10n_au.super.stream.line"].create(super_line_vals)

    def action_open_superstream(self):
        return self._get_superstreams()._get_records_action()

    def action_register_payment(self):
        """ Exclude the super payment lines from the payment.
            Super lines will be registered with the superstream record.
        """
        res = super().action_register_payment()
        clearing_house = self.env.ref('l10n_au_hr_payroll_account.res_partner_clearing_house', raise_if_not_found=False)
        if not clearing_house:
            raise UserError(_("No clearing house record found for this company!"))
        super_account = clearing_house.property_account_payable_id
        lines_to_exclude = self.move_id.line_ids.filtered(lambda l: l.account_id == super_account)
        res['context']['active_ids'] = [l for l in res['context']['active_ids'] if l not in lines_to_exclude.ids]
        return res
