# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict
from datetime import datetime, date
from math import floor
from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.exceptions import UserError

PERIODS_PER_YEAR = {
    "daily": 260,
    "weekly": 52,
    "bi-weekly": 26,
    "monthly": 12,
    "quarterly": 4,
    "yearly": 1,
}


class HrPayslip(models.Model):
    _inherit = "hr.payslip"

    l10n_au_income_stream_type = fields.Selection(
        related="contract_id.l10n_au_income_stream_type")
    l10n_au_foreign_tax_withheld = fields.Float(
        string="Foreign Tax Withheld",
        help="Foreign tax withheld for the current financial year")
    l10n_au_exempt_foreign_income = fields.Float(
        string="Exempt Foreign Income",
        help="Exempt foreign income for the current financial year")
    l10n_au_allowance_withholding = fields.Float(
        string="Withholding for Allowance",
        help="Amount to be withheld from allowances")
    l10n_au_schedule_pay = fields.Selection(related="contract_id.schedule_pay", store=True, index=True)
    l10n_au_termination_type = fields.Selection([
        ("normal", "Non-Genuine Redundancy"),
        ("genuine", "Genuine Redundancy"),
    ], required=True, default="normal", string="Termination Type")
    l10n_au_is_termination = fields.Boolean("Termination Payslip")

    def _get_base_local_dict(self):
        res = super()._get_base_local_dict()
        slips = self._l10n_au_get_year_to_date_slips()
        res.update({
            "year_slips": slips,
            "ytd_total": self._l10n_au_get_year_to_date_totals(),
            "ytd_gross": slips._get_line_values(['GROSS'], compute_sum=True)['GROSS']['sum']['total'],
        })
        return res

    def _get_daily_wage(self):
        schedule_pay = self.contract_id.schedule_pay
        wage = self.contract_id.wage

        if schedule_pay == "daily":
            return wage
        elif schedule_pay == "weekly":
            return wage / 5
        elif schedule_pay == "bi-weekly":
            return wage / 10
        elif schedule_pay == "monthly":
            return wage * 3 / 13 / 5
        elif schedule_pay == "quarterly":
            return wage / 13 / 5
        else:
            return wage

    def _compute_input_line_ids(self):
        for payslip in self:
            if not payslip.struct_id or payslip.company_id.country_id.code != "AU":
                continue
            # this only works if the payslip is saved after struct type is changed, because it depends on the structure
            # type that was selected before.
            new_types = payslip.struct_id.type_id.l10n_au_default_input_type_ids
            # Remove the lines not default for new structure and keep user defined allowances
            to_remove_lines = payslip.input_line_ids.filtered(lambda i: i.input_type_id not in new_types and i.l10n_au_is_default_allowance)
            to_remove_vals = [(2, line.id) for line in to_remove_lines]
            to_add_vals = []
            # Add default lines not already on the payslip
            for default_allowance in new_types.filtered(lambda x: x not in payslip.input_line_ids.input_type_id):
                to_add_vals.append((0, 0, {
                    'amount': default_allowance.l10n_au_default_amount,
                    'input_type_id': default_allowance.id,
                    'l10n_au_is_default_allowance': True,
                }))
            input_line_vals = to_remove_vals + to_add_vals
            payslip.update({'input_line_ids': input_line_vals})
            # automatic description for other types
            for line in payslip.input_line_ids.filtered(lambda line: line.code == "OD"):
                line.name = line.input_type_id.name.split("-")[1].strip()
        return super()._compute_input_line_ids()

    def _l10n_au_get_year_to_date_slips(self):
        start_year = self.contract_id._l10n_au_get_financial_year_start(self.date_from)
        year_slips = self.env["hr.payslip"].search([
            ("employee_id", "=", self.employee_id.id),
            ("company_id", "=", self.company_id.id),
            ("state", "in", ["paid", "done"]),
            ("date_from", ">=", start_year),
            ("date_from", "<=", self.date_from),
        ], order="date_from")
        if self.env.context.get('l10n_au_include_current_slip'):
            year_slips |= self
        return year_slips

    def _l10n_au_get_year_to_date_totals(self):
        year_slips = self._l10n_au_get_year_to_date_slips()
        totals = {
            "slip_lines": defaultdict(lambda: defaultdict(float)),
            "worked_days": defaultdict(lambda: defaultdict(float)),
            "periods": len(year_slips),
        }
        for line in year_slips.line_ids:
            totals["slip_lines"][line.category_id.name]["total"] += line.total
            totals["slip_lines"][line.category_id.name][line.code] += line.total
        for line in year_slips.worked_days_line_ids:
            totals["worked_days"][line.work_entry_type_id]["amount"] += line.amount
        return totals

    @api.model
    def _l10n_au_compute_weekly_earning(self, amount, period):
        """ Given an amount and a pay schedule, calculate the weekly earning used to calculate withholding amounts.
        The amount given should already include any allowances that are subject to withholding.

        The calculation, recommended by the legislation, is as follows:

        Example:
            Weekly income                           $ 467.59
            Add allowance subject to withholding    $ 9.50
            Total earnings (ignore cents)           $ 477.00
            Add 99 cents                            $ 0.99
          Weekly earnings                           $ 477.99

        If the period is other than weekly, for withholding purposes, we should calculate the equivalent weekly earnings
        and use it for the computation.

        :param amount: The amount paid in the period.
        :param period: The pay schedule in use (weekly, fortnightly or monthly)
        :return: the weekly earnings subject to withholding
        """
        if period == "monthly" and round(amount % 1, 2) == 0.33:
            amount += 0.01
        weekly_amount = self._l10n_au_convert_amount(amount, period, "weekly")
        return floor(weekly_amount) + 0.99

    @api.model
    def _l10n_au_convert_amount(self, amount, period_from, period_to):
        coefficient = PERIODS_PER_YEAR[period_from] / PERIODS_PER_YEAR[period_to]
        return amount * coefficient

    def _l10n_au_compute_withholding_amount(self, period_earning, period, coefficients):
        """
        Compute the withholding amount for the given period.

        :param period_earning: The gross earning (after allowances subjects to withholding)
        :param period: The type of pay schedule (weekly, fortnightly, or monthly)
        :param coefficients: The scale that should be applied to this employee. It will depend on their schedule.
        """
        self.ensure_one()
        employee_id = self.employee_id
        contract = self.contract_id
        # if custom withholding rate
        if contract.l10n_au_withholding_variation:
            return period_earning * contract.l10n_au_withholding_variation_amount / 100

        # Compute the weekly earning as per government legislation.
        # They recommend to calculate the weekly equivalent of the earning, if using another pay schedule.
        weekly_earning = self._l10n_au_compute_weekly_earning(period_earning, period)
        weekly_withhold = 0.0

        # For scale 4 (no tfn provided), cents are ignored when applying the rate.
        if employee_id.l10n_au_scale == "4":
            coefficients = self._rule_parameter("l10n_au_withholding_no_tfn")
            coefficient = coefficients["foreign"] if employee_id.is_non_resident else coefficients["national"]
            weekly_withhold = floor(weekly_earning) * (coefficient / 100)
            return self._l10n_au_convert_amount(weekly_withhold, "weekly", period)

        # The formula to compute the withholding amount is:
        #   y = a * x - b, where:
        #   y is the weekly amount to withhold
        #   x is the number of whole dollars in the weekly earning + 99 cents
        #   a and b are the coefficient defined in the data.
        coefficients = coefficients[employee_id.l10n_au_scale]
        for coef in coefficients:
            if weekly_earning < float(coef[0]):
                weekly_withhold = coef[1] * weekly_earning - coef[2]
                break

        amount = round(weekly_withhold)
        period_amount = self._l10n_au_convert_amount(amount, "weekly", period)
        if period in ["daily", "monthly"]:
            period_amount = round(period_amount)
        return period_amount

    def _l10n_au_compute_medicare_adjustment(self, period_earning, period, params):
        self.ensure_one()
        params = params.copy()
        employee_id = self.employee_id
        if employee_id.children and employee_id.marital in ["cohabitant", "married"]:
            params["MLFT"] += employee_id.children * params["ADDC"]

        params["MLFT"] = round(params["MLFT"] / params["WFTD"], 2)
        params["SOP"] = round(params["MLFT"] * params["SOPM"] / params["SOPD"])
        weekly_earning = self._l10n_au_compute_weekly_earning(period_earning, period)

        adjustment = 0.0
        if weekly_earning < params["WEST"]:
            adjustment = (weekly_earning - params["WLA"]) * params["SOPM"]
        elif weekly_earning < params["MLFT"]:
            adjustment = weekly_earning * params["ML"]
        elif weekly_earning < params["SOP"]:
            adjustment = (params["MLFT"] * params["ML"]) - ((weekly_earning - params["MLFT"]) * params["SOPD"])

        amount = round(adjustment)
        period_amount = self._l10n_au_convert_amount(amount, "weekly", period)
        if period in ["daily", "monthly"]:
            period_amount = round(period_amount)
        return period_amount

    def _l10n_au_compute_lumpsum_withhold(self, lumpsum):
        '''
        Withholding for back payments is calculated by apportioning it over the number of periods it applies for and
        summing the difference in withholding over every period.
        '''
        self.ensure_one()
        return lumpsum * 0.47

    def _l10n_au_compute_loan_withhold(self, period_earning, period, coefficients):
        self.ensure_one()
        weekly_earning = self._l10n_au_compute_weekly_earning(period_earning, period)
        weekly_withhold = 0.0
        if weekly_earning <= coefficients[0][1]:
            return 0.0

        for coef in coefficients:
            if coef[1] == "inf" or weekly_earning <= coef[1]:
                weekly_withhold = coef[2] / 100 * weekly_earning
                break

        amount = round(weekly_withhold)
        period_amount = self._l10n_au_convert_amount(amount, "weekly", period)
        if period in ["daily", "monthly"]:
            period_amount = round(period_amount)

        return period_amount

    def _l10n_au_compute_termination_withhold(self, employee_id, ytd_total):
        """
        Compute the withholding amount for the termination payment.

        It is done in x steps:
            - We first work out the smallest cap that will apply to this withholding computation
            - We use this cap to work out the withholding amount

        Currently missing feature in the computation:
            - Multiple payments for a single termination. This could happen and will affect the cap.
            - Death benefits. The withholding amount is impacted by a number of factor, like the beneficiary of the payment.
            - Foreign residents tax treaties, which should exempt a foreign resident from a country with a treaty from the withholding tax.
            - Tax free component.
                An ETP has a tax-free component if part of the payment relate to invalidity or employment before 1 July 1983
            - Handling delayed withholding.

        The withholding amount is rounded up to the nearest dollar.
        If no TFN is provided, the cents are ignored when calculating the withholding amount.
        """
        self.ensure_one()

        # 1) Working out the smallest cap.
        # ================================
        # We first calculate the whole-of-income cap by subtracting the sum of taxable payments made to the employee from $180000
        # We then compare the whole-of-income cap with the ETP cap amount. This amount changes every year.
        # If both caps are equal, we use the whole-of-income cap. Otherwise, we use the smallest of the two caps.

        whole_of_income_cap = (self._rule_parameter("l10n_au_whoic_cap")
                               - ytd_total["slip_lines"]["Taxable Salary"]["total"])
        etp_cap = self._rule_parameter("l10n_au_etp_cap")
        smallest_withholding_cap = min(whole_of_income_cap, etp_cap)

        # 2) Working out the withholding amount
        # =====================================
        # An ETP can be made up of a tax-free component and a taxable component from which we much withheld an amount.
        # The tax-free component is exempt from any withholding.

        # The withheld will be different if the employee as given its TFN to the employer.
        # In this case, we apply the amount calculated by applying the table rounded up to the nearest dollar.

        # For a foreign resident, it will depend on whether there is a tax treaty with their country of residence.
        # If the ETP is only assessable in the other country, no withholding is required.
        # It the ETP is assessable in Australia, the withholding is using the same table but requires to exclude the Medicare levy of 2%

        # When a TFN has not been provided, you must withhold 47% to a resident and 45% to a foreign resident.
        # =====================================

        # a) Compute the preservation age.
        # The withholding amount varies depending on whether the employee has reached their preservation age by the
        # end of the income year in which the payment is made.

        if not employee_id.birthday:
            raise UserError(_("In order to process a termination payment, a birth date should be set on the private information tab of the employee's form view."))

        tfn_provided = employee_id.l10n_au_scale != '4'
        is_non_resident = employee_id.is_non_resident
        life_benefits_etp_rates = self._rule_parameter("l10n_au_etp_withholding_life_benefits")
        over_the_cap_rate = life_benefits_etp_rates['over_cap']
        no_tfn_rate = life_benefits_etp_rates['no_tfn']

        # These two payments are subjects to a tax-free limit.
        genuine_redundancy = self.env.ref("l10n_au_hr_payroll.input_genuine_redundancy")
        early_retirement = self.env.ref("l10n_au_hr_payroll.input_early_retirement_scheme")

        preservation_ages = self._rule_parameter("l10n_au_preservation_age")
        # The preservation age is determined based on the financial year in which the employee was born.
        birth_financial_year = self.contract_id._l10n_au_get_financial_year_start(employee_id.birthday).year
        years_list = list(preservation_ages['years'].values())
        if birth_financial_year < years_list[0]:
            preservation_age = preservation_ages['before']
        elif birth_financial_year > years_list[-1]:
            preservation_age = preservation_ages['after']
        else:
            preservation_age = preservation_ages['years'][str(birth_financial_year)]

        is_of_or_over_preservation_age = relativedelta(date.today(), employee_id.birthday).years >= preservation_age

        # b) Some payments have a tax free limit, which depends on the completed years of services.
        complete_years_of_service = relativedelta(self.date_to, employee_id.first_contract_date).years
        base_tax_free_limit = self._rule_parameter("l10n_au_tax_free_base")
        tax_free_limit = base_tax_free_limit + (complete_years_of_service * self._rule_parameter("l10n_au_tax_free_year"))

        # c) tax-free component.
        tax_free_amount = 0.0

        # d) Compute the withholding.
        withholding_amount = 0.0
        # We need to always deal with the payment subject to the ETP cap first.
        for input_line in self.input_line_ids.sorted(key=lambda i: 0 if i.input_type_id.l10n_au_etp_type == 'excluded' else 1):
            if not input_line.input_type_id.l10n_au_is_etp:
                continue
            taxable_amount = input_line.amount
            applicable_tax_free_limit = 0
            # We check if the payment is subject to a tax-free limit.
            if input_line.input_type_id in {genuine_redundancy, early_retirement}:
                applicable_tax_free_limit = tax_free_limit

            tax_free_amount += min(applicable_tax_free_limit, input_line.amount)
            taxable_amount = max(0, taxable_amount - applicable_tax_free_limit)
            # Besides that, the remaining taxable amounts are all subjects to withholding.
            # If no tfn has been provided, the rate will be fixed to 47% (for residents) or 45% (for non-residents)
            if not tfn_provided:
                applicable_rate = no_tfn_rate
            else:
                age_group = 'over' if is_of_or_over_preservation_age else 'under'
                applicable_rate = life_benefits_etp_rates[input_line.input_type_id.l10n_au_etp_type][age_group]

            # If a foreign resident's ETP is assessable in Australia, Adjust the rate to exclude the Medicare levy of 2%.
            if is_non_resident:
                applicable_rate -= 2
            # Depending on the type of payment, we either use the ETP cap, or the smallest ETP cap computed earlier.
            applicable_cap = etp_cap if input_line.input_type_id.l10n_au_etp_type == 'excluded' else smallest_withholding_cap
            # Separate between the amount below the cap, and the amount above the cap (if any)
            taxable_amount_under_cap = min(applicable_cap, taxable_amount)
            taxable_amount_over_cap = taxable_amount - taxable_amount_under_cap
            # Then apply the rates accordingly.
            if tfn_provided:
                withholding_amount += taxable_amount_under_cap * (applicable_rate / 100)
                withholding_amount += taxable_amount_over_cap * (over_the_cap_rate / 100)
            else:  # When no tfn is provided, ignore the cents when computing the withholding amount.
                withholding_amount += int(taxable_amount_under_cap * (applicable_rate / 100))
                withholding_amount += int(taxable_amount_over_cap * (over_the_cap_rate / 100))
            etp_cap -= taxable_amount

        return round(withholding_amount), tax_free_amount

    def _l10n_au_get_leaves_for_withhold(self):
        self.ensure_one()
        cutoff_dates = [datetime(1978, 8, 16).date(), datetime(1993, 8, 17).date()]
        leaves_by_date = {
            "annual": {
                "pre_1978": 0.0,
                "pre_1993": 0.0,
                "post_1993": 0.0,
            },
            "long_service": {
                "pre_1978": 0.0,
                "pre_1993": 0.0,
                "post_1993": 0.0,
            },
            "leaves_amount": 0.0,
        }
        leaves = self.env["hr.leave.allocation"].search([
            ("state", "=", "validate"),
            ("holiday_status_id.l10n_au_leave_type", "in", ['annual', 'long_service']),
            ("employee_id", "=", self.employee_id.id),
            ("date_from", "<=", self.contract_id.date_end or self.date_to),
        ])
        daily_wage = self._get_daily_wage()
        for leave in leaves:
            if leave.leaves_taken == leave.number_of_days:
                continue
            leave_type = leaves_by_date[leave.holiday_status_id.l10n_au_leave_type]
            amount = (leave.number_of_days - leave.leaves_taken) * daily_wage
            if leave.holiday_status_id.l10n_au_leave_type == 'annual' and self.contract_id.l10n_au_leave_loading == 'regular':
                amount *= 1 + (self.contract_id.l10n_au_leave_loading_rate / 100)

            if leave.date_from < cutoff_dates[0]:
                leave_type["pre_1978"] += amount
            elif leave.date_from < cutoff_dates[1]:
                leave_type["pre_1993"] += amount
            else:
                leave_type["post_1993"] += amount
            leaves_by_date["leaves_amount"] += amount
        return leaves_by_date

    def _l10n_au_get_unused_leave_hours(self):
        # Only annual and long service leaves are to be taken into account for termination payments
        leaves = self.env["hr.leave.allocation"].search([
            ("state", "=", "validate"),
            ("holiday_status_id.l10n_au_leave_type", "in", ['annual', 'long_service']),
            ("employee_id", "=", self.employee_id.id),
            ("date_from", "<=", self.contract_id.date_end or self.date_to),
        ])
        unused_days = sum([(leave.number_of_days - leave.leaves_taken) for leave in leaves])
        return unused_days * self.contract_id.resource_calendar_id.hours_per_day

    def _l10n_au_calculate_marginal_withhold(self, leave_amount, coefficients, basic_amount):
        self.ensure_one()
        period = self.contract_id.schedule_pay
        amount_per_period = leave_amount / PERIODS_PER_YEAR[period]

        normal_withhold = self._l10n_au_compute_withholding_amount(basic_amount, period, coefficients)
        leave_withhold = self._l10n_au_compute_withholding_amount(basic_amount + amount_per_period, period, coefficients)

        extra_withhold = leave_withhold - normal_withhold
        return extra_withhold * PERIODS_PER_YEAR[period]

    def _l10n_au_calculate_long_service_leave_withholding(self, leave_withholding_rate, long_service_leaves, basic_amount):
        self.ensure_one()
        coefficients = self._rule_parameter("l10n_au_withholding_coefficients")["regular"]
        pre_1978 = long_service_leaves["pre_1978"]
        pre_1993 = long_service_leaves["pre_1993"]
        post_1993 = long_service_leaves["post_1993"]

        flat_part = pre_1993
        marginal_part = pre_1978 * 0.05

        if self.l10n_au_termination_type == "normal":
            marginal_part += post_1993
        else:
            flat_part += post_1993

        marginal_withhold = round(self._l10n_au_calculate_marginal_withhold(marginal_part, coefficients, basic_amount))
        flat_withhold = round(flat_part * float(leave_withholding_rate) / 100)
        return flat_withhold + marginal_withhold

    def _l10n_au_calculate_annual_leave_withholding(self, leave_withholding_rate, annual_leaves, basic_amount):
        self.ensure_one()
        coefficients = self._rule_parameter("l10n_au_withholding_coefficients")["regular"]
        pre_1993 = annual_leaves["pre_1993"]
        post_1993 = annual_leaves["post_1993"]

        flat_part = pre_1993
        marginal_part = 0.0

        if self.l10n_au_termination_type == "normal":
            marginal_part += post_1993
        else:
            flat_part += post_1993

        marginal_withhold = round(self._l10n_au_calculate_marginal_withhold(marginal_part, coefficients, basic_amount))
        flat_withhold = round(flat_part * float(leave_withholding_rate) / 100)

        return flat_withhold + marginal_withhold

    def _l10n_au_compute_unused_leaves_withhold(self, basic_amount):
        self.ensure_one()
        leaves = self._l10n_au_get_leaves_for_withhold()
        l10n_au_leave_withholding = self._rule_parameter("l10n_au_leave_withholding")
        withholding = 0.0
        # 2. Calculate long service leave withholding
        long_service_leaves = leaves["long_service"]
        withholding += self._l10n_au_calculate_long_service_leave_withholding(l10n_au_leave_withholding, long_service_leaves, basic_amount)
        # 3. Calculate annual leave withholding
        annual_leaves = leaves["annual"]
        withholding += self._l10n_au_calculate_annual_leave_withholding(l10n_au_leave_withholding, annual_leaves, basic_amount)
        return leaves["leaves_amount"], withholding, 0.0

    def _l10n_au_compute_child_support(self, net_earnings):
        self.ensure_one()
        pea = self._rule_parameter("l10n_au_pea")
        employee_id = self.employee_id

        # garnishee child support does not apply the pea, first apply the lumpsum deductions
        # then the regular deductions
        lumpsum_child_support = sum(self.input_line_ids.sudo().filtered(lambda inpt: inpt.input_type_id.code == 'CHILD_SUPPORT').mapped('amount'))
        lumpsum_child_support = min(net_earnings, lumpsum_child_support)
        withhold = lumpsum_child_support
        net_earnings -= withhold

        if net_earnings:
            if employee_id.l10n_au_child_support_garnishee == "fixed":
                withhold += min(net_earnings, employee_id.l10n_au_child_support_garnishee_amount)
            elif employee_id.l10n_au_child_support_garnishee == "percentage":
                withhold += net_earnings * employee_id.l10n_au_child_support_garnishee_amount
            net_earnings -= withhold

        if net_earnings > pea:
            net_over_pea = net_earnings - pea
            withhold += min(net_over_pea, employee_id.l10n_au_child_support_deduction)
        return withhold

    def _l10n_au_has_extra_pay(self):
        self.ensure_one()
        return self.contract_id._l10n_au_get_weeks_amount() == 53
