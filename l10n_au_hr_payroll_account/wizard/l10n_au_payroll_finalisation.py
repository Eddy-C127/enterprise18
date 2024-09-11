# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, Command, fields, models, _
from odoo.tools import date_utils, format_list


class L10nAUPayrollFinalisationWizard(models.TransientModel):
    _name = "l10n_au.payroll.finalisation.wizard"
    _description = "STP Finalisation"

    name = fields.Char("Name", compute="_compute_name", required=True)
    company_id = fields.Many2one("res.company", default=lambda self: self.env.company, string="Company", required=True)
    abn = fields.Char("ABN", related="company_id.vat")
    branch_code = fields.Char(related="company_id.l10n_au_branch_code")
    bms_id = fields.Char(related="company_id.l10n_au_bms_id")
    date_deadline = fields.Date("Deadline Date", default=lambda self: fields.Date.today(), required=True)
    declaration_type = fields.Selection([
        ("eofy", "EOFY Declaration"),
        ("individual", "Individual Declaration"),
        ("amendment", "Amendment Declaration")
    ], default="eofy", required=True)
    date_start = fields.Date("Date Start", compute="_compute_date_period", store=True, readonly=False, required=True)
    date_end = fields.Date("Date End", compute="_compute_date_period", store=True, readonly=False, required=True)
    fiscal_year = fields.Char(string="Fiscal Year", compute="_compute_date_period", store=True, required=True)
    l10n_au_payroll_finalisation_emp_ids = fields.One2many("l10n_au.payroll.finalisation.wizard.emp", "l10n_au_payroll_finalisation_id", string="Employees")
    responsible_user_id = fields.Many2one("res.users", string="Responsible User", default=lambda self: self.env.company.l10n_au_stp_responsible_id.user_id, required=True)

    @api.depends("date_start", "date_end", "declaration_type")
    def _compute_name(self):
        for rec in self:
            if rec.declaration_type == "eofy":
                rec.name = _("EOYF Finalisation - %s", (rec.fiscal_year))
            elif rec.declaration_type == "individual":
                employees = rec.l10n_au_payroll_finalisation_emp_ids.employee_id
                rec.name = _("Individual Finalisation - %s", (format_list(employees.mapped('name'))))

    @api.depends("company_id", "declaration_type")
    def _compute_date_period(self):
        for rec in self:
            fiscal_start, fiscal_end = date_utils.get_fiscal_year(fields.Date.today(), rec.company_id.fiscalyear_last_day, int(rec.company_id.fiscalyear_last_month))
            rec.date_start = fiscal_start
            rec.date_end = fiscal_end if rec.declaration_type == "eofy" else fields.Date.today()
            rec.fiscal_year = f"{rec.date_start.strftime('%Y')}/{rec.date_end.strftime('%y')}"

    def submit_to_ato(self):
        self.ensure_one()
        stp = self.env["l10n_au.stp"].create({
            "name": self.name,
            "company_id": self.company_id.id,
            "payevent_type": "update",
            "is_finalisation": True,
            "l10n_au_stp_emp": [
                Command.create({
                    "employee_id": emp.employee_id.id,
                })
                for emp in self.l10n_au_payroll_finalisation_emp_ids
            ]
        })
        return stp._get_records_action()


class L10nAUPayrollFinalisationEmp(models.TransientModel):
    _name = "l10n_au.payroll.finalisation.wizard.emp"
    _description = "STP Finalisation Employees"

    l10n_au_payroll_finalisation_id = fields.Many2one("l10n_au.payroll.finalisation.wizard", string="Finalisation Wizard", required=True, ondelete="cascade")
    company_id = fields.Many2one(related="l10n_au_payroll_finalisation_id.company_id", string="Company", store=True)
    employee_id = fields.Many2one("hr.employee", string="Employee", required=True)
    contract_id = fields.Many2one("hr.contract", related="employee_id.contract_id", string="Contract", required=True)
    contract_start_date = fields.Date("Contract Start Date", related="contract_id.date_start", required=True)
    contract_end_date = fields.Date("Contract End Date", related="contract_id.date_end")
    contract_active = fields.Boolean("Active", related="contract_id.active")
    ytd_balance_ids = fields.Many2many("l10n_au.payslip.ytd", "YTD Balances", compute="_compute_amounts_to_report")
    payslip_ids = fields.Many2many("hr.payslip", "Payslips", compute="_compute_amounts_to_report")

    @api.depends("employee_id")
    def _compute_amounts_to_report(self):
        for rec in self:
            rec.ytd_balance_ids = self.env["l10n_au.payslip.ytd"].search(
                [
                    ("employee_id", "=", rec.employee_id.id),
                    ("finalised", "=", False)
                ]
            )
            rec.payslip_ids = self.employee_id.slip_ids.filtered_domain(
                [
                    ("date_from", ">=", rec.l10n_au_payroll_finalisation_id.date_start),
                    ("date_to", "<=", rec.l10n_au_payroll_finalisation_id.date_end),
                    ("state", "in", ("done", "paid")),
                ]
            )
