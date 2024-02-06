# Part of Odoo. See LICENSE file for full copyright and licensing details.

import io
import base64

from odoo import api, fields, models, _
from odoo.tools import format_list, groupby, itemgetter, pycompat
from odoo.exceptions import UserError, ValidationError
from odoo.tools.float_utils import float_compare



class L10auSuperStream(models.Model):
    _name = "l10n_au.super.stream"
    _description = "Super Stream"

    state = fields.Selection(
        selection=[
            ("draft", "Draft"),
            ("locked", "Locked"),
            ("processing", "In Process"),
            ("done", "Done"),
        ],
        default='draft', string="Status",
        readonly=True, copy=False, index=True,
    )
    name = fields.Char(default="Draft", readonly=True)
    company_id = fields.Many2one('res.company', required=True, default=lambda self: self.env.company)
    currency_id = fields.Many2one("res.currency", "Currency", default=lambda self: self.env.company.currency_id, readonly=True)
    vat = fields.Char(related="company_id.vat", readonly=True)
    l10n_au_super_stream_lines = fields.One2many("l10n_au.super.stream.line", "l10n_au_super_stream_id", string="SuperStream Line")
    file_version = fields.Char(default="1.0", required=True)
    # == Unique file sequence ==
    file_id = fields.Char("File ID", required=True)
    source_entity_id = fields.Char("Source Entity ID", compute="_compute_sid")
    source_entity_id_type = fields.Selection([("abn", "ABN")], required=True, default="abn")
    super_stream_file = fields.Many2one("ir.attachment", readonly=True, copy=False)
    journal_id = fields.Many2one(string="Bank Journal", comodel_name="account.journal")
    paid_date = fields.Datetime(readonly=True)
    amount_total = fields.Monetary(compute="_compute_amount_total")
    payment_id = fields.Many2one("account.payment", ondelete="restrict")

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            seq = self.env["ir.sequence"].next_by_code("super.stream")
            vals.update({
                "file_id": seq,
                "name": seq,
            })
        return super().create(vals_list)

    @api.depends("source_entity_id_type")
    def _compute_sid(self):
        for rec in self:
            if rec.source_entity_id_type == "abn":
                rec.source_entity_id = rec.vat

    @api.depends(
        "l10n_au_super_stream_lines",
        "l10n_au_super_stream_lines.superannuation_guarantee_amount",
        "l10n_au_super_stream_lines.award_or_productivity_amount",
        "l10n_au_super_stream_lines.personal_contributions_amount",
        "l10n_au_super_stream_lines.salary_sacrificed_amount",
        "l10n_au_super_stream_lines.voluntary_amount",
        "l10n_au_super_stream_lines.spouse_contributions_amount",
        "l10n_au_super_stream_lines.child_contributions_amount",
        "l10n_au_super_stream_lines.other_third_party_contributions_amount",
    )
    def _compute_amount_total(self):
        fields = [
            "superannuation_guarantee_amount", "award_or_productivity_amount",
            "personal_contributions_amount", "salary_sacrificed_amount",
            "voluntary_amount", "spouse_contributions_amount",
            "child_contributions_amount", "other_third_party_contributions_amount",
        ]
        amounts = self.env["l10n_au.super.stream.line"].read_group(
            [("l10n_au_super_stream_id", "in", self.ids)],
            fields,
            ["l10n_au_super_stream_id"],
        )
        amounts = {
            amount["l10n_au_super_stream_id"][0]: sum(item[0] in fields and item[1]
                                                    for item in amount.items())
                                                    for amount in amounts
                                                    }
        for rec in self:
            rec.amount_total = amounts[rec.id]

    @api.constrains('state', 'journal_id')
    def _check_journal(self):
        if self.filtered(lambda x: x.state == "done" and not x.journal_id):
            raise ValidationError(_("SuperStream cannot be validated without Bank Journal!"))

    def prepare_rendering_data(self):
        header_line = self._get_header_line()
        categories_line = self._get_categories_line()
        details_line = self._get_details_line()
        data_lines = self._get_data_lines()
        return [header_line, categories_line, details_line, *data_lines]

    def action_register_super_payment(self):
        self.ensure_one()

        if self.state in ['draft', 'done']:
            raise UserError(_(
                "You can't generate a new SAFF file while the super stream is in %s state.",
                self.state))

        if not self.journal_id:
            raise UserError(_('Please select a payment journal before continuing.'))

        # Create file
        self.state = 'done'
        self._create_super_stream_file()

        # To be changed to direct debit once the api is implimented
        pay_method_line = self.journal_id._get_available_payment_method_lines('outbound').filtered(
            lambda x: x.code == 'manual')
        clearing_house_partner = self.env.ref('l10n_au_hr_payroll_account.res_partner_clearing_house', raise_if_not_found=False)
        if not clearing_house_partner.property_account_payable_id:
            raise UserError(_("Please set the SuperStream Payable Account for company %s.", self.company_id.name))

        # Prepare payment entry
        self.payment_id = self.env['account.payment'].create({
            'date': fields.Datetime.now(),
            'amount': self.amount_total,
            'payment_type': 'outbound',
            'partner_id': clearing_house_partner.id,
            'partner_type': 'supplier',
            'ref': self.name,
            'journal_id': self.journal_id.id,
            'currency_id': self.currency_id.id,
            'payment_method_line_id': pay_method_line.id,
        })
        self.payment_id.action_post()
        # Reconcile Payment with Payslip Journal Entries
        payslip_entries = self.l10n_au_super_stream_lines.payslip_id.move_id
        if all(p.state != 'posted' for p in payslip_entries):
            raise UserError(_(
                "Some Journal Entries for the related Payslips are not posted."
                "Please post them before Registering payment.\n%s",
                '\n'.join(payslip_entries.mapped('name'))))

        (payslip_entries.line_ids + self.payment_id.line_ids)\
            .filtered_domain([('account_id', '=', self.payment_id.destination_account_id.id), ('reconciled', '=', False)])\
            .reconcile()
        return self.action_open_payment()

    def action_open_payment(self):
        return self.payment_id._get_records_action()

    def _create_super_stream_file(self):
        self.ensure_one()

        self.super_stream_file.unlink()
        with io.BytesIO() as output:
            writer = pycompat.csv_writer(output, delimiter=';', quotechar='"', quoting=2)
            data = self.prepare_rendering_data()
            writer.writerows(data)
            base64_result = base64.encodebytes(output.getvalue())

        self.super_stream_file = self.env["ir.attachment"].create(
            {
                "name": self.file_id + ".csv",
                "datas": base64_result,
                "type": "binary",
                "res_model": "l10n_au.super.stream",
                "res_id": self.id,
            }
        )

    def _get_header_line(self):
        return ["VERSION", self.file_version, "Negatives Supported", "False", "File ID", self.file_id]

    def _get_categories_line(self):
        line = [""] * 133
        line[0] = "Line ID"  # A2
        line[1] = "Header"   # B2
        line[5] = "Sender"   # F2
        line[12] = "Payer"   # M2
        line[17] = "Payee/Receiver"  # R2
        line[29] = "Employer"        # AD2
        line[33] = "Super Fund Member Common"  # AH2
        line[57] = "Super Fund Member Contributions"  # BF2
        line[67] = "Super Fund Member Registration"  # BP2
        line[83] = "Defined Benefits Contributions"  # CF2
        line[99] = "SuperDefined Benefit Registration"  # CV2
        return line

    def _get_details_line(self):
        line = [
            "ID", "SourceEntityID", "SourceEntityIDType", "SourceElectronicServiceAddress", "ElectronicErrorMessaging", "ABN", "Organisational Name Text", "Family Name",
            "Given Name", "Other Given Name", "E-mail Address Text", "Telephone Minimal Number", "ABN", "Organisational Name Text", "BSB Number", "Account Number",
            "Account Name Text", "ABN", "USI", "Organisational Name Text", "TargetElectronicServiceAddress", "Payment Method Code", "Transaction Date",
            "Payment/Customer Reference Number", "Bpay Biller Code", "Payment Amount", "BSB Number", "Account Number", "Account Name Text", "ABN", "Location ID",
            "Organisational Name Text", "Superannuation Fund Generated Employer Identifier", "TFN", "Person Name Title Text", "Person Name Suffix text", "Family Name",
            "Given Name", "Other Given Name", "Sex Code", "Birth Date", "Address Usage Code", "Address Details Line 1 Text", "Address Details Line 2 Text",
            "Address Details Line 3 Text", "Address Details Line 4 Text", "Locality Name Text", "Postcode Text", "State or Territory Code", "Country Code",
            "E-mail Address Text", "Telephone Minimal Number Landline", "Telephone Minimal Number Mobile", "Member Client Identifier", "Payroll Number Identifier",
            "Employment End Date", "Employment End Reason Text", "Pay Period Start Date", "Pay Period End Date", "Superannuation Guarantee Amount",
            "Award or Productivity Amount", "Personal Contributions Amount", "Salary Sacrificed Amount", "Voluntary Amount", "Spouse Contributions Amount",
            "Child Contributions Amount", "Other Third Party Contributions Amount", "Employment Start Date", "At Work Indicator", "Annual Salary for Benefits Amount",
            "Annual Salary for Contributions Amount", "Annual Salary for Contributions Effective Start Date", "Annual Salary for Contributions Effective End Date",
            "Annual Salary for Insurance Amount", "Weekly Hours Worked Number", "Occupation Description", "Insurance Opt Out Indicator", "Fund Registration Date",
            "Benefit Category Text", "Employment Status Code", "Super Contribution Commence Date", "Super Contribution Cease Date",
            "Member Registration Amendment Reason Text", "Defined Benefit Member Pre Tax Contribution", "Defined Benefit Member Post Tax Contribution",
            "Defined Benefit Employer Contribution", "Defined Benefit Notional Member Pre Tax Contribution", "Defined Benefit Notional Member Post Tax Contribution",
            "Defined Benefit Notional Employer Contribution", "Ordinary Time Earnings", "Actual Periodic Salary or Wages Earned", "Superannuable Allowances Paid",
            "Notional Superannuable Allowances", "Service Fraction", "Service Fraction Effective Date", "Full Time Hours", "Contracted Hours", "Actual Hours Paid",
            "Employee Location Identifier", "Service Fraction", "Service Fraction Start Date", "Service Fraction End Date", "Defined Benefit Employer Rate",
            "Defined Benefit Employer Rate Start Date", "Defined Benefit Employer Rate End Date", "Defined Benefit Member Rate", "Defined Benefit Member Rate Start Date",
            "Defined Benefit Member Rate End Date", "Defined Benefit Annual Salary 1", "Defined Benefit Annual Salary 1 Start Date",
            "Defined Benefit Annual Salary 1 End Date", "Defined Benefit Annual Salary 2", "Defined Benefit Annual Salary 2 Start Date",
            "Defined Benefit Annual Salary 2 End Date", "Defined Benefit Annual Salary 3", "Defined Benefit Annual Salary 3 Start Date",
            "Defined Benefit Annual Salary 3 End Date", "Defined Benefit Annual Salary 4", "Defined Benefit Annual Salary 4 Start Date",
            "Defined Benefit Annual Salary 4 End Date", "Defined Benefit Annual Salary 5", "Defined Benefit Annual Salary 5 Start Date",
            "Defined Benefit Annual Salary 5 End Date", "Leave Without Pay Code", "Leave Without Pay Code Start Date", "Leave Without Pay Code End Date",
            "Annual Salary for Insurance Effective Date", "Annual Salary for Benefits Effective Date", "Employee Status Effective Date",
            "Employee Benefit Category Effective Date", "Employee Location Identifier", "Employee Location Identifier Start Date", "Employee Location Identifier End Date"]
        return line

    def _get_data_lines(self):
        lines = []
        for idx, line in enumerate(self.l10n_au_super_stream_lines):
            lines.append(line._get_data_line(idx))
        return lines

    def action_confirm(self):
        if not self.journal_id:
            raise UserError(_('Please select a payment journal before locking this document.'))
        self._check_super_account_proportions()
        self.write({'state': 'locked'})

    def action_draft(self):
        for rec in self:
            if rec.state in ['processing', 'done']:
                raise UserError(_("You cannot reset a SuperStream once in %s!", rec.state))
            rec.state = 'draft'

    def _check_super_account_proportions(self):
        """Checks if each payslip has 100% proportion assigned.
        """
        invalid = self.env['hr.payslip']
        for key, lines in groupby(
            self.l10n_au_super_stream_lines,
            itemgetter("l10n_au_super_stream_id", "payslip_id"),
        ):
            if float_compare(sum(line.proportion for line in lines), 1, precision_digits=2) != 0:
                invalid |= key[1]
        if invalid:
            raise UserError(_(
                "The employee(s) for following payslips do not have 100%% super contribution assigned: %s",
                format_list(self.env, invalid.mapped("name")),
            ))


class L10nauSuperStreamLine(models.Model):
    _name = "l10n_au.super.stream.line"
    _description = "Super Stream Line"

    name = fields.Char(compute="_compute_name", default="Draft")
    l10n_au_super_stream_id = fields.Many2one("l10n_au.super.stream", ondelete='cascade')
    state = fields.Selection(related='l10n_au_super_stream_id.state')
    company_id = fields.Many2one("res.company", related="l10n_au_super_stream_id.company_id")
    currency_id = fields.Many2one(related="l10n_au_super_stream_id.currency_id", readonly=True)

    employer_id = fields.Many2one("res.company", related="l10n_au_super_stream_id.company_id", required=True, string="Employer")
    sender_id = fields.Many2one("hr.employee", default=lambda self: self.env.user.employee_id, required=True)
    employee_id = fields.Many2one("hr.employee", required=True)
    payee_id = fields.Many2one("l10n_au.super.fund", "Payee/Reciever", related="super_account_id.fund_id", required=True)

    # == Super Fund Member ==
    payslip_id = fields.Many2one("hr.payslip", required=True, ondelete="cascade")
    super_account_id = fields.Many2one("l10n_au.super.account", required=True, domain="[('id', 'in', allowed_super_account_ids)]")
    allowed_super_account_ids = fields.Many2many("l10n_au.super.account", compute="_compute_allowed_super_account_ids")
    # Contribution
    start_date = fields.Date("Period Start Date", related="payslip_id.date_from")
    end_date = fields.Date("Period End Date", related="payslip_id.date_to")
    proportion = fields.Float(related="super_account_id.proportion", readonly=True)
    superannuation_guarantee_amount = fields.Monetary(
        compute="_compute_payslip_fields", precompute=True, store=True, readonly=False
    )
    award_or_productivity_amount = fields.Monetary()
    personal_contributions_amount = fields.Monetary()
    salary_sacrificed_amount = fields.Monetary(
        compute="_compute_payslip_fields", precompute=True, store=True, readonly=False
    )
    voluntary_amount = fields.Monetary()
    spouse_contributions_amount = fields.Monetary()
    child_contributions_amount = fields.Monetary()
    other_third_party_contributions_amount = fields.Monetary()

    # Registration
    employment_start_date = fields.Date(related="payslip_id.contract_id.date_start", store=True, readonly=False)
    at_work_indicator = fields.Boolean(compute="_compute_payslip_fields", precompute=True, store=True, readonly=False)
    annual_salary_for_benefits_amount = fields.Monetary()
    annual_salary_for_contributions_amount = fields.Monetary(
        compute="_compute_payslip_fields", precompute=True, store=True, readonly=False
    )
    annual_salary_for_contributions_effective_start_date = fields.Date()
    annual_salary_for_contributions_effective_end_date = fields.Date()
    annual_salary_for_insurance_amount = fields.Monetary()
    weekly_hours_worked_number = fields.Float()
    occupation_description = fields.Char()
    insurance_opt_out_indicator = fields.Boolean()
    fund_registration_date = fields.Date()
    benefit_category_text = fields.Char()
    employment_status_code = fields.Selection([
        ("Casual", "Casual"),
        ("Contractor", "Contractor"),
        ("Full time", "Full time"),
        ("Part time", "Part time")
    ])
    super_contribution_commence_date = fields.Date()
    super_contribution_cease_date = fields.Date()
    member_registration_amendment_reason_text = fields.Char()

    @api.ondelete(at_uninstall=False)
    def _unlink_except_done(self):
        if any(line.state == "done" for line in self):
            raise UserError(_("You cannot delete a superstream record once it has been moved to done!"))

    @api.depends("employee_id", "payslip_id")
    def _compute_name(self):
        for rec in self:
            rec.name = f"{rec.employee_id.display_name or ''} - {rec.payslip_id.display_name or ''}"

    @api.depends("payslip_id", 'super_account_id', 'proportion')
    def _compute_payslip_fields(self):
        super_lines_total = self.payslip_id._get_line_values(['SUPER', 'SUPER.CONTRIBUTION'], vals_list=['total'])
        for rec in self:
            if rec.state != 'draft':
                continue
            rec.superannuation_guarantee_amount = super_lines_total['SUPER'][rec.payslip_id.id]['total'] * rec.proportion
            rec.salary_sacrificed_amount = super_lines_total['SUPER.CONTRIBUTION'][rec.payslip_id.id]['total'] * rec.proportion
            rec.annual_salary_for_contributions_amount = rec.payslip_id.contract_id.l10n_au_yearly_wage
            rec.at_work_indicator = rec.payslip_id.contract_id.state == "open"

    @api.depends('employee_id')
    def _compute_allowed_super_account_ids(self):
        self.allowed_super_account_ids = False
        for rec in self:
            if rec.employee_id:
                rec.allowed_super_account_ids = rec.employee_id._get_active_super_accounts()

    def _get_data_line(self, idx):
        if self.employee_id.gender == "male":
            gender = '1'
        elif self.employee_id.gender == "female":
            gender = '2'
        elif self.employee_id.gender == "other":
            gender = '3'
        else:
            gender = '0'

        line = [
            # name | excel columns ( inclusive ) | number of columns | 0-index of columns
            # header data [A:E] (5) (0 - 4)
            idx,
            self.l10n_au_super_stream_id.source_entity_id or "",
            self.l10n_au_super_stream_id.source_entity_id_type or "",
            "", "",

            # sender data [F:L] (7) (5 - 11)
            self.sender_id.l10n_au_abn or "",
            self.company_id.name or "",
            ' '.join(self.sender_id.name.split(' ')[1:]),
            self.sender_id.name.split(' ')[0],
            "",  # Other given name
            self.sender_id.work_email or "",
            self.sender_id.work_phone or "",

            # payer data [M:Q] (5) (12 - 16)
            self.employer_id.vat,
            self.employer_id.display_name,
            self.l10n_au_super_stream_id.journal_id.aba_bsb,
            self.l10n_au_super_stream_id.journal_id.bank_acc_number,
            self.l10n_au_super_stream_id.journal_id.bank_account_id.partner_id.name,

            # payee/receiver data [R:AC] (12) (17 - 28)
            self.payee_id.abn or "",
            self.payee_id.usi or "",
            self.payee_id.display_name or "",
            self.payee_id.esa or "",
            "", "", "", "", "", "", "", "",  # fields for the clearing house

            # employer data [AD:AG] (4) (29 - 32)
            self.employer_id.vat or "",
            "",
            self.employer_id.display_name or "",
            self.employer_id.l10n_au_sfei or "",

            # super fund member common [AH:BE] (24) (33 - 56)
            self.employee_id.l10n_au_tfn,
            "", "",
            ' '.join(self.employee_id.name.split(' ')[1:]),
            self.employee_id.name.split(' ')[0],
            "",  # Other given name
            gender,
            fields.Date.to_string(self.employee_id.birthday) or "",
            "RES",
            self.employee_id.private_street or "",
            self.employee_id.private_street2 or "",
            "", "",
            self.employee_id.private_city or "",
            self.employee_id.private_zip or "",
            self.employee_id.private_state_id.code or "",
            self.employee_id.private_country_id.code or "",
            self.employee_id.work_email or "",
            self.employee_id.work_phone or "",
            self.employee_id.mobile_phone or "",
            "", "", "", "",

            # super fund member contributions [BF:BO] (10) (57 - 66)
            fields.Date.to_string(self.start_date),
            fields.Date.to_string(self.end_date),
            self.superannuation_guarantee_amount or "",
            self.award_or_productivity_amount or "",
            self.personal_contributions_amount or "",
            abs(self.salary_sacrificed_amount) or "",
            self.voluntary_amount or "",
            self.spouse_contributions_amount or "",
            self.child_contributions_amount or "",
            self.other_third_party_contributions_amount or "",

            # super fund member registration [BP:CE] (16) (67 - 82)
            fields.Date.to_string(self.employment_start_date),
            self.at_work_indicator or "",
            self.annual_salary_for_benefits_amount or "",
            self.annual_salary_for_contributions_amount or "",
            fields.Date.to_string(self.annual_salary_for_contributions_effective_start_date) or "",
            fields.Date.to_string(self.annual_salary_for_contributions_effective_end_date) or "",
            self.annual_salary_for_insurance_amount or "",
            self.weekly_hours_worked_number or "",
            self.occupation_description or "",
            self.insurance_opt_out_indicator or "",
            fields.Date.to_string(self.fund_registration_date) or "",
            self.benefit_category_text or "",
            self.employment_status_code or "",
            fields.Date.to_string(self.super_contribution_commence_date) or "",
            fields.Date.to_string(self.super_contribution_cease_date) or "",
            self.member_registration_amendment_reason_text or "",

            # defined benefits contributions [CF:CU] (16) (83 - 98)
            "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",

            # defined benefits registration [CV:EC] (34) (99 - 132)
            "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
            "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
        ]

        return line
