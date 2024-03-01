# Part of Odoo. See LICENSE file for full copyright and licensing details.
from math import ceil

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.exceptions import UserError

OVERTIME_CASUAL_LOADING_COEF = 1.25
SATURDAY_CASUAL_LOADING_COEF = 1.50
SUNDAY_CASUAL_LOADING_COEF = 1.75
PUBLIC_HOLIDAY_CASUAL_LOADING_COEF = 2.5

CESSATION_TYPE_CODE = [
    ("V", "(V) Voluntary Cessation"),
    ("I", "(I) Ill Health"),
    ("D", "(D) Deceased"),
    ("R", "(R) Redundancy"),
    ("F", "(F) Dismissal"),
    ("C", "(C) Contract Cessation"),
    ("T", "(T) Transfer"),
]


class HrContract(models.Model):
    _inherit = 'hr.contract'

    l10n_au_casual_loading = fields.Float(string="Casual Loading")
    l10n_au_pay_day = fields.Selection(
        selection=[
            ("0", "Monday"),
            ("1", "Tuesday"),
            ("2", "Wednesday"),
            ("3", "Thursday"),
            ("4", "Friday"),
            ("5", "Saturday"),
            ("6", "Sunday")],
        string="Regular Pay Day")
    l10n_au_leave_loading = fields.Selection(
        selection=[
            ("regular", "Regular"),
            ("once", "Lump Sum")],
        string="Leave Loading",
        help="How leave loading, if any, is to be paid. If Lump Sum is selected, leave loading will not be added to regular payslips automatically")
    l10n_au_leave_loading_leave_types = fields.Many2many(
        "hr.leave.type",
        string="Leave Types for Leave Loading",
        help="Leave Types that should be taken into account for leave loading, both regular and lump sum.")
    l10n_au_leave_loading_rate = fields.Float(string="Leave Loading Rate (%)")
    l10n_au_employment_basis_code = fields.Selection(
        selection=[
            ("F", "(F) Full time"),
            ("P", "(P) Part time"),
            ("C", "(C) Casual"),
            ("L", "(L) Labour hire"),
            ("V", "(V) Voluntary agreement"),
            ("D", "(D) Death beneficiary"),
            ("N", "(N) Non-employee")],
        string="Employment Code",
        default="F",
        required=True,
        compute="_compute_l10n_au_employment_basis_code",
        readonly=False,
        store=True)
    l10n_au_tax_treatment_category = fields.Selection(
        related="structure_type_id.l10n_au_tax_treatment_category", string="Category")
    l10n_au_tax_treatment_option = fields.Selection(
        [
            ("T", "(T) Tax-free Threshold"),
            ("N", "(N) No Tax-free Threshold"),
            ("D", "(D) Daily Work Pattern"),
            ("P", "(P) Promotional Program"),
            ("F", "(F) Foreign Resident"),
            ("A", "(A) Australian Resident"),
            ("R", "(R) Registered"),
            ("U", "(U) Unregistered"),
            ("C", "(C) Commissioner's Instalment Rate"),
            ("O", "(O) Other Rate"),
            ("S", "(S) Single"),
            ("M", "(M) Married"),
            ("I", "(I) Illness-separated"),
            ("V", "(V) Downward Variation"),
            ("B", "(B) Death Beneficiary"),
            ("Z", "(Z) Non-employee"),
        ],
        default="T", required=True, compute="_compute_l10n_au_tax_treatment_option",
        readonly=False, string="Option")
    l10n_au_tax_treatment_code = fields.Char(string="Code", store=True,
        compute="_compute_l10n_au_tax_treatment_code")
    l10n_au_cessation_type_code = fields.Selection(
        CESSATION_TYPE_CODE,
        string="Cessation Type",
        help="""
            "V": an employee resignation, retirement, domestic or pressing necessity or abandonment of employment.
            "I": an employee resignation due to medical condition that prevents the continuation of employment, such as for illness, ill-health, medical unfitness or total permanent disability.
            "D": the death of an employee.
            "R": an employer-initiated termination of employment due to a genuine bona-fide redundancy or approved early retirement scheme.
            "F": an employer-initiated termination of employment due to dismissal, inability to perform the required work, misconduct or inefficiency.
            "C": the natural conclusion of a limited employment relationship due to contract/engagement duration or task completion, seasonal work completion, or to cease casuals that are no longer required.
            "T": the administrative arrangements performed to transfer employees across payroll systems, move them temporarily to another employer (machinery of government for public servants), transfer of business, move them to outsourcing arrangements or other such technical activities.
        """)
    l10n_au_withholding_variation = fields.Boolean(string="Withholding Variation", help="Employee has a custom withholding rate.")
    l10n_au_withholding_variation_amount = fields.Float(string="Withholding Variation rate")
    l10n_au_performances_per_week = fields.Integer(string="Performances per week")
    l10n_au_income_stream_type = fields.Selection(related="structure_type_id.l10n_au_income_stream_type", readonly=False)
    l10n_au_country_code = fields.Many2one("res.country", string="Country", help="Country where the work is performed")
    l10n_au_workplace_giving_type = fields.Selection(
        selection=[
            ('none', 'None'),
            ("employee_deduction", "Employee Deduction"),
            ("employer_deduction", "Employer Deduction"),
            ("both", "Employer and Employee Deductions"),
        ], required=True, default='none', string='Workplace Giving Type'
    )
    l10n_au_workplace_giving = fields.Float(string="Workplace Giving Employee", compute="_compute_workplace_giving", readonly=False, store=True)
    l10n_au_workplace_giving_employer = fields.Float(string="Workplace Giving Employer", compute="_compute_workplace_giving", readonly=False, store=True)
    l10n_au_salary_sacrifice_superannuation = fields.Float(string="Salary Sacrifice Superannuation")
    l10n_au_salary_sacrifice_other = fields.Float(string="Salary Sacrifice Other Benefits")
    l10n_au_yearly_wage = fields.Monetary(string="Yearly Wage", compute="_compute_wages", inverse="_inverse_yearly_wages", readonly=False, store=True)
    wage = fields.Monetary(compute="_compute_wages", readonly=False, store=True)
    hourly_wage = fields.Monetary(compute="_compute_wages", readonly=False, store=True)

    _sql_constraints = [(
        "l10n_au_casual_loading_span",
        "CHECK(l10n_au_casual_loading >= 0 AND l10n_au_casual_loading <= 100)",
        "The casual loading is a percentage and should have a value between 0 and 100."
    )]

    @api.constrains('employee_id', 'schedule_pay')
    def _check_l10n_au_schedule_pay(self):
        allowed_schedule_pay = ('daily', 'weekly', 'bi-weekly', 'monthly', 'quarterly')
        for contract in self:
            if contract.country_code == 'AU' and contract.schedule_pay not in allowed_schedule_pay:
                raise UserError(_('Australian contracts are only supported for daily, weekly, fortnightly, monthly and quarterly pay schedules.'))

    @api.depends('wage_type')
    def _compute_l10n_au_employment_basis_code(self):
        for contract in self:
            contract.l10n_au_employment_basis_code = "C" if contract.wage_type == "hourly" else "F"

    @api.depends("l10n_au_tax_treatment_category", "employee_id", "employee_id.l10n_au_tax_free_threshold", "employee_id.is_non_resident", "employee_id.marital")
    def _compute_l10n_au_tax_treatment_option(self):
        for contract in self:
            is_non_resident = contract.employee_id.is_non_resident
            if contract.l10n_au_tax_treatment_category in ("R", "A"):
                tax_treatment = "T" if contract.employee_id.l10n_au_tax_free_threshold else "N"
            elif contract.l10n_au_tax_treatment_category == "C":
                tax_treatment = "F" if is_non_resident else "T"
            elif contract.l10n_au_tax_treatment_category == "S":
                tax_treatment = "M" if contract.employee_id.marital in ("married", "cohabitant") else "S"
            elif contract.l10n_au_tax_treatment_category == "H":
                tax_treatment = "F" if is_non_resident else "R"
            elif contract.l10n_au_tax_treatment_category == "N":
                tax_treatment = "F" if is_non_resident else "A"
            elif contract.l10n_au_tax_treatment_category == "D":
                tax_treatment = "V" if contract.l10n_au_withholding_variation else "B"
            else:
                tax_treatment = contract.l10n_au_tax_treatment_option
            contract.l10n_au_tax_treatment_option = tax_treatment

    @api.depends(
        "l10n_au_tax_treatment_category", "l10n_au_tax_treatment_option",
        "employee_id.l10n_au_training_loan",
        "employee_id.l10n_au_medicare_exemption",
        "employee_id.l10n_au_medicare_surcharge",
        "employee_id.l10n_au_medicare_reduction")
    def _compute_l10n_au_tax_treatment_code(self):
        for contract in self:
            tax_treatment_code_values = [
                contract.l10n_au_tax_treatment_category or "",
                contract.l10n_au_tax_treatment_option or "",
                ("S" if contract.employee_id.l10n_au_training_loan else "X"),
                contract.employee_id.l10n_au_medicare_exemption or "",
                contract.employee_id.l10n_au_medicare_surcharge or "",
                contract.employee_id.l10n_au_medicare_reduction or "",
            ]
            contract.l10n_au_tax_treatment_code = "".join(tax_treatment_code_values)

    @api.depends("wage_type", "wage", "hourly_wage")
    def _compute_wages(self):
        for contract in self:
            if contract.country_code != "AU":
                continue
            hours_per_day = contract.resource_calendar_id.hours_per_day
            # YTI TODO Clean that brol
            _l10n_au_convert_amount = self.env['hr.payslip']._l10n_au_convert_amount
            if contract.wage_type == "hourly":
                contract.wage = _l10n_au_convert_amount(contract.hourly_wage * hours_per_day, "daily", contract.schedule_pay)
                contract.l10n_au_yearly_wage = _l10n_au_convert_amount(contract.hourly_wage * hours_per_day, "daily", "yearly")
            else:
                contract.hourly_wage = _l10n_au_convert_amount(contract.wage, contract.schedule_pay, "daily") / hours_per_day
                contract.l10n_au_yearly_wage = _l10n_au_convert_amount(contract.wage, contract.schedule_pay, "yearly")

    @api.depends('l10n_au_workplace_giving_type')
    def _compute_workplace_giving(self):
        """ Changing the workplace_giving_type requires resetting the unused value to 0 """
        for contract in self:
            workplace_employee_giving = workplace_employer_giving = 0
            giving_type = contract.l10n_au_workplace_giving_type
            if giving_type == 'employee_deduction':
                workplace_employee_giving = contract.l10n_au_workplace_giving
            elif giving_type == 'employer_deduction':
                workplace_employer_giving = contract.l10n_au_workplace_giving_employer
            elif giving_type == 'both':
                workplace_employee_giving = contract.l10n_au_workplace_giving
                workplace_employer_giving = contract.l10n_au_workplace_giving_employer

            contract.write({
                'l10n_au_workplace_giving': workplace_employee_giving,
                'l10n_au_workplace_giving_employer': workplace_employer_giving,
            })

    def _inverse_yearly_wages(self):
        if self.country_code != "AU":
            return
        hours_per_day = self.resource_calendar_id.hours_per_day
        # YTI TODO Clean that brol
        _l10n_au_convert_amount = self.env['hr.payslip']._l10n_au_convert_amount
        self.wage = _l10n_au_convert_amount(self.l10n_au_yearly_wage, "yearly", self.schedule_pay)
        self.hourly_wage = _l10n_au_convert_amount(self.l10n_au_yearly_wage, "yearly", "daily") / hours_per_day

    def get_hourly_wages(self):
        self.ensure_one()
        return {
            "overtime": self.hourly_wage * (OVERTIME_CASUAL_LOADING_COEF + self.l10n_au_casual_loading / 100),
            "saturday": self.hourly_wage * (SATURDAY_CASUAL_LOADING_COEF + self.l10n_au_casual_loading / 100),
            "sunday": self.hourly_wage * (SUNDAY_CASUAL_LOADING_COEF + self.l10n_au_casual_loading / 100),
            "public_holiday": self.hourly_wage * (PUBLIC_HOLIDAY_CASUAL_LOADING_COEF + self.l10n_au_casual_loading / 100),
        }

    @api.model
    def _l10n_au_get_financial_year_start(self, date):
        if date.month < 7:
            return date + relativedelta(years=-1, month=7, day=1)
        return date + relativedelta(month=7, day=1)

    @api.model
    def _l10n_au_get_financial_year_end(self, date):
        if date.month < 7:
            return date + relativedelta(month=6, day=30)
        return date + relativedelta(years=1, month=6, day=30)

    @api.model
    def _l10n_au_get_weeks_amount(self, date=False):
        """ Returns the amount of pay weeks in the current financial year.
        In leap years, there will be an additional week/fortnight.
        """
        target_day = date or fields.Date.context_today(self)
        start_day = self._l10n_au_get_financial_year_start(target_day)
        end_day = self._l10n_au_get_financial_year_end(target_day) + relativedelta(day=30)
        return ceil((end_day - start_day).days / 7)
