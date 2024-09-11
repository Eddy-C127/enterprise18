from odoo import api, fields, models


class L10nAuSTPEmp(models.Model):
    _name = "l10n_au.stp.emp"
    _description = "STP Employee"

    employee_id = fields.Many2one(
        "hr.employee", string="Employee", required=True)
    payslip_ids = fields.Many2many(
        "hr.payslip", string="Payslip", compute="_compute_ytd")
    ytd_balance_ids = fields.Many2many(
        "l10n_au.payslip.ytd", string="YTD Balances", compute="_compute_ytd")
    currency_id = fields.Many2one(
        "res.currency", related="stp_id.currency_id", readonly=True)
    stp_id = fields.Many2one(
        "l10n_au.stp", string="Single Touch Payroll")
    ytd_gross = fields.Monetary("Total Gross", compute="_compute_ytd")
    ytd_tax = fields.Monetary("Total Tax", compute="_compute_ytd")
    ytd_super = fields.Monetary("Total Super", compute="_compute_ytd")
    ytd_rfba = fields.Monetary("Total RFBA", compute="_compute_ytd")
    ytd_rfbae = fields.Monetary("Total RFBA-E", compute="_compute_ytd")

    @api.depends("employee_id")
    def _compute_ytd(self):
        for emp in self:
            emp.payslip_ids = emp.employee_id.slip_ids.filtered(lambda p: not p.l10n_au_finalised)
            emp.ytd_balance_ids = self.env['l10n_au.payslip.ytd'].search([
                ('employee_id', '=', emp.employee_id.id),
                ('finalised', '=', False)
            ])
            last_payslip = emp.payslip_ids.sorted("date_from", reverse=True)[:1]
            ytd_vals = last_payslip._get_line_values(["BASIC", "WITHHOLD.TOTAL", "SUPER", "RFBA"], vals_list=['ytd'])
            emp.ytd_gross = ytd_vals["BASIC"][last_payslip.id]["ytd"]
            emp.ytd_tax = ytd_vals["WITHHOLD.TOTAL"][last_payslip.id]["ytd"]
            emp.ytd_super = ytd_vals["SUPER"][last_payslip.id]["ytd"]
            emp.ytd_rfba = ytd_vals["RFBA"][last_payslip.id]["ytd"]
            emp.ytd_rfbae = 0
