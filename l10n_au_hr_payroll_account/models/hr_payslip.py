# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import api, Command, fields, models, _
from odoo.exceptions import UserError


class HrPayslip(models.Model):
    _inherit = "hr.payslip"

    has_superstream = fields.Boolean(compute="_compute_has_superstream")
    l10n_au_stp_status = fields.Selection([
        ("draft", "Draft"),
        ("ready", "Ready"),
        ("sent", "Submitted"),
        ("error", "Error"),
    ], string="STP Status", compute="_compute_stp_status")
    l10n_au_finalised = fields.Boolean("Finalised", default=False, readonly=True, copy=False)

    @api.model_create_multi
    def create(self, vals_list):
        payslips = super().create(vals_list)
        payslips._add_to_stp()
        return payslips

    @api.depends('state')
    def _compute_has_superstream(self):
        for rec in self:
            rec.has_superstream = bool(rec._get_superstreams())

    @api.depends('state')
    def _compute_stp_status(self):
        stp_records = self.env['l10n_au.stp'].search([('payslip_ids', 'in', self.ids)])
        for payslip in self:
            if payslip.country_code != 'AU':
                payslip.l10n_au_stp_status = False
            elif payslip.state not in ('done', 'paid'):
                payslip.l10n_au_stp_status = 'draft'
            else:
                stp = stp_records.filtered(lambda r: payslip in r.payslip_ids)
                payslip.l10n_au_stp_status = 'sent' if stp.state == 'sent' else 'ready'

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
        if not self.env.context.get("allow_ffr") and any(state == 'sent' for state in self.mapped("l10n_au_stp_status")):
            raise UserError(_("A payslip cannot be reset to draft after submitting to ATO."))
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

    def _add_to_stp(self):
        stp = self.env["l10n_au.stp"].search(
            [
                ("state", "=", "generate"),
                ("payslip_batch_id", "=", self.payslip_run_id.id),
                ('company_id', '=', self.company_id.id)
            ],
            order="create_date desc",
            limit=1,
        )

        if not stp:
            stp = self.env['l10n_au.stp'].create({'company_id': self.company_id.id})

        stp.write({
            'payslip_batch_id': self.payslip_run_id.id,
            'payslip_ids': [Command.link(rec) for rec in self.ids],
        })

    def action_open_payslip_stp(self):
        if self.payslip_run_id:
            stp = self.env['l10n_au.stp'].search([('payslip_batch_id', '=', self.payslip_run_id.id)], limit=1)
        else:
            stp = self.env['l10n_au.stp'].search([('payslip_ids', '=', self.id)], limit=1)
        return {
            'name': _('STP Report'),
            'type': 'ir.actions.act_window',
            'res_model': 'l10n_au.stp',
            'view_mode': 'form',
            'res_id': stp.id,
            'target': 'current',
        }

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

    def action_payslip_payment_report(self, export_format='aba'):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'hr.payroll.payment.report.wizard',
            'view_mode': 'form',
            'view_id': 'hr_payslip_payment_report_view_form',
            'views': [(False, 'form')],
            'target': 'new',
            'context': {
                'default_payslip_ids': self.ids,
                'default_payslip_run_id': self.payslip_run_id.id,
                'default_export_format': export_format,
            },
        }

    def _l10n_au_get_year_to_date_totals(self, fields_to_compute=None, l10n_au_include_current_slip=False, include_ytd_balances=True):
        totals = super()._l10n_au_get_year_to_date_totals(fields_to_compute=fields_to_compute, l10n_au_include_current_slip=l10n_au_include_current_slip)
        if include_ytd_balances:
            ytd_balances = self.env["l10n_au.payslip.ytd"].search([("employee_id", "in", self.employee_id.ids)])
            for ytd_balance in ytd_balances:
                totals["slip_lines"][ytd_balance.rule_id.category_id.name]["total"] += ytd_balance.ytd_amount
                totals["slip_lines"][ytd_balance.rule_id.category_id.name][ytd_balance.rule_id.code] += ytd_balance.ytd_amount
            for work_entry_line in ytd_balances.l10n_au_payslip_ytd_input_ids.filtered(lambda l: l.res_model == "hr.work.entry.type"):
                totals["worked_days"][work_entry_line.work_entry_type]["amount"] += work_entry_line.ytd_amount

        return totals

    def _l10n_au_get_ytd_inputs(self, l10n_au_include_current_slip=False, include_ytd_balances=True):
        totals = super()._l10n_au_get_ytd_inputs(l10n_au_include_current_slip=l10n_au_include_current_slip)
        if not include_ytd_balances:
            return totals

        ytd_balances = self.env["l10n_au.payslip.ytd"].search([("employee_id", "in", self.employee_id.ids)])
        for input_line in ytd_balances.l10n_au_payslip_ytd_input_ids.filtered(lambda l: l.res_model == "hr.payslip.input.type"):
            totals[input_line.input_type]["amount"] += input_line.ytd_amount

        return totals
