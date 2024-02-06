# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import re

from datetime import datetime

from odoo import api, fields, models, _
from odoo.exceptions import UserError, RedirectWarning
from odoo.tools import float_round


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
                message=_("The account %s, of journal '%s', is not valid for ABA.\nEither its account number is incorrect or it has no BSB set.", bank_account.acc_number, journal_id.name),
                action=bank_account._get_records_action(name=_("Configure Account"), target="new"),
                button_text=_("Configure Account")
            )
        if not journal_id.aba_fic or not journal_id.aba_user_spec or not journal_id.aba_user_number:
            raise RedirectWarning(
                        message=_("ABA fields for account '%s', of journal '%s', are not set. Please set the fields under ABA section!", bank_account.acc_number, journal_id.name),
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
        export_file_data = {
            'filename': f'ABA-{journal_id.code}-{filename_date}.aba',
            'file': base64.encodebytes(self._create_aba_document(journal_id).encode()),
        }

        self.payslip_run_id.write({
            'l10n_au_export_aba_file': export_file_data['file'],
            'l10n_au_export_aba_filename': export_file_data['filename'],
        })

    def _create_aba_document(self, journal_id):
        def _normalise_bsb(bsb):
            if not bsb:
                return ""
            test_bsb = re.sub('( |-)', '', bsb)
            return '%s-%s' % (test_bsb[0:3], test_bsb[3:6])

        def to_fixed_width(string, length, fill=' ', right=False):
            return right and string[0:length].rjust(length, fill) or string[0:length].ljust(length, fill)

        def append_detail(detail_summary, detail_record, credit, debit):
            detail_summary['detail_records'].append(detail_record)
            if len(detail_summary['detail_records']) > 999997:
                raise UserError(_('Too many transactions for one ABA file - Please split in to multiple transfers'))
            detail_summary['credit_total'] += credit
            detail_summary['debit_total'] += debit
            if detail_summary['credit_total'] > 99999999.99 or detail_summary['debit_total'] > 99999999.99:
                raise UserError(_('The value of transactions is too high for one ABA file - Please split in to multiple transfers'))

        aba_date = fields.Date.context_today(self)
        header_record = '0' + (' ' * 17) + '01' \
            + to_fixed_width(journal_id.aba_fic, 3) \
            + (' ' * 7) \
            + to_fixed_width(journal_id.aba_user_spec, 26) \
            + to_fixed_width(journal_id.aba_user_number, 6, fill='0', right=True) \
            + to_fixed_width('PAYMENTS', 12) \
            + aba_date.strftime('%d%m%y') \
            + (' ' * 40)

        detail_summary = {
            'detail_records': [],
            'credit_total': 0,
            'debit_total': 0,
        }

        aud_currency = self.env["res.currency"].search([('name', '=', 'AUD')], limit=1)
        bank_account = journal_id.bank_account_id
        for payslip in self:
            credit = float_round(payslip.net_wage, 2)
            debit = 0
            if credit > 99999999.99 or debit > 99999999.99:
                raise UserError(_('Individual amount of payslip %s is too high for ABA file - Please adjust', payslip.number))
            detail_record = '1' \
                + _normalise_bsb(payslip.employee_id.bank_account_id.aba_bsb) \
                + to_fixed_width(payslip.employee_id.bank_account_id.acc_number, 9, right=True) \
                + ' ' + '50' \
                + to_fixed_width(str(round(aud_currency.round(credit) * 100)), 10, '0', right=True) \
                + to_fixed_width(payslip.employee_id.bank_account_id.acc_holder_name or payslip.employee_id.name, 32) \
                + to_fixed_width(payslip.number or 'Payment', 18) \
                + _normalise_bsb(bank_account.aba_bsb) \
                + to_fixed_width(bank_account.acc_number, 9, right=True) \
                + to_fixed_width(bank_account.acc_holder_name or journal_id.company_id.name, 16) \
                + ('0' * 8)
            append_detail(detail_summary, detail_record, credit, debit)

        if journal_id.aba_self_balancing:
            # self balancing line use payment bank on both sides.
            credit = 0
            debit = detail_summary['credit_total']
            aba_date = fields.Date.context_today(self)
            detail_record = '1' \
                + _normalise_bsb(bank_account.aba_bsb) \
                + to_fixed_width(bank_account.acc_number, 9, right=True) \
                + ' ' + '13' \
                + to_fixed_width(str(round(aud_currency.round(debit) * 100)), 10, fill='0', right=True) \
                + to_fixed_width(bank_account.acc_holder_name or journal_id.company_id.name, 32) \
                + to_fixed_width('PAYMENTS %s' % aba_date.strftime('%d%m%y'), 18) \
                + _normalise_bsb(bank_account.aba_bsb) \
                + to_fixed_width(bank_account.acc_number, 9, right=True) \
                + to_fixed_width(bank_account.acc_holder_name or journal_id.company_id.name, 16) \
                + ('0' * 8)
            append_detail(detail_summary, detail_record, credit, debit)

        footer_record = '7' + '999-999' + (' ' * 12) \
            + to_fixed_width(str(round(aud_currency.round(abs(detail_summary['credit_total'] - detail_summary['debit_total'])) * 100)), 10, fill='0', right=True) \
            + to_fixed_width(str(round(aud_currency.round(detail_summary['credit_total']) * 100)), 10, fill='0', right=True) \
            + to_fixed_width(str(round(aud_currency.round(detail_summary['debit_total']) * 100)), 10, fill='0', right=True) \
            + (' ' * 24) \
            + to_fixed_width(str(len(detail_summary['detail_records'])), 6, fill='0', right=True) \
            + (' ' * 40)

        SEPARATOR = '\r\n'
        return header_record + SEPARATOR + SEPARATOR.join(detail_summary['detail_records']) + SEPARATOR + footer_record + SEPARATOR

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
