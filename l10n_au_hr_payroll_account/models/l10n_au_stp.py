# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
from lxml import etree
from datetime import date
from collections import defaultdict
import re
import logging

from odoo import api, fields, models, _
from odoo.tools.misc import file_path
from odoo.tools import float_compare, float_round
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)

EMPLOYEE_REQUIRED_FIELDS = [
    "l10n_au_tfn", "name", "birthday",
    "private_street", "private_city", "private_state_id", "private_zip",
    "private_country_id", "private_email", "private_phone",
]

COMPANY_REQUIRED_FIELDS = [
    "vat", "l10n_au_bms_id", "l10n_au_stp_responsible_id", "email", "phone", "zip"
]


def strip_phonenumber(phone: str):
    return ''.join(re.findall(r'(\d+)', phone))


class L10nAuSTP(models.Model):
    _name = "l10n_au.stp"
    _description = "Single Touch Payroll"
    _order = "create_date desc"
    _inherit = ["mail.thread", "mail.activity.mixin"]

    name = fields.Char(string="Name", compute="_compute_name")
    payslip_batch_id = fields.Many2one("hr.payslip.run", string="Payslip Batch")
    payslip_ids = fields.Many2many("hr.payslip", string="Payslip")
    company_id = fields.Many2one("res.company", string="Company", required=True, default=lambda self: self.env.company)
    currency_id = fields.Many2one(
        "res.currency",
        string="Currency",
        compute="_compute_currency_id",
        readonly=True,
    )
    payevent_type = fields.Selection(
        [("submit", "Submit"), ("adjust", "Adjust"), ("update", "Update")],
        string="Submission Type",
        required=True,
        default="submit",
        help="""Submission type of the report
                Submit: Submit a new report
                Adjust: Adjust an Employer Record
                Update: Update an Employee Record from a past report""",
    )
    ffr = fields.Boolean(
        string="Full File Replacement",
        help="Indicates if this report should replace the previous report with the same transaction identifier")
    previous_report_id = fields.Many2one(
        "l10n_au.stp", string="Previous Report",
        help="Report which you are updating")
    submit_date = fields.Date(
        string="Submit Date",
        help="Enter manual submit date if you want to submit the report at a particular date")
    submission_id = fields.Char(
        string="Submission ID",
        readonly=True,
        help="Submission ID of the report")
    # XML report fields
    state = fields.Selection([("draft", "Draft"), ("sent", "Submitted")], default="draft")
    xml_file = fields.Binary("XML File", readonly=True, store=True)
    xml_filename = fields.Char()
    xml_validation_state = fields.Selection([
        ("normal", "N/A"),
        ("done", "Valid"),
        ("invalid", "Invalid"),
    ], default="normal")
    error_message = fields.Char("Error Message")
    warning_message = fields.Char(compute="_compute_warning_message")

    # constraints ffr, cannot be true if type is update
    _sql_constraints = [
        ("ffr", "CHECK(ffr = false OR payevent_type = 'submit')", "Full File Replacement cannot be true if type is 'update'."),
        ("l10n_au_l10n_au_previous_report", "CHECK(previous_report_id != id)", "A report can't update iself.")
    ]

    @api.model_create_multi
    def create(self, vals_list):
        res = super().create(vals_list)
        for rec in res:
            rec.activity_schedule(
                "l10n_au_hr_payroll_account.l10n_au_activity_submit_stp",
                user_id=rec.company_id.l10n_au_stp_responsible_id.user_id.id
            )
        return res

    @api.depends("payslip_ids", "payslip_batch_id")
    def _compute_currency_id(self):
        for report in self:
            if report.payslip_batch_id:
                report.currency_id = report.payslip_batch_id.currency_id
            else:
                report.currency_id = report.payslip_ids[:1].currency_id

    @api.depends("payslip_batch_id", "payslip_ids", "payevent_type")
    def _compute_name(self):
        for report in self:
            # TODO: Add a reference of payevent type
            if report.payslip_batch_id:
                report.name = report.payslip_batch_id.name
            else:
                period = self.payslip_ids and self.payslip_ids[0]._get_period_name({})
                report.name = f"Out of Cycle Reporting - {period}"

    def _compute_warning_message(self):
        for report in self:
            company_warnings, user_warnings = [], []
            company = self.company_id
            user = self.company_id.l10n_au_stp_responsible_id
            for field in COMPANY_REQUIRED_FIELDS:
                if not company[field]:
                    company_warnings.append(company._fields[field].string)
            if user:
                for field in EMPLOYEE_REQUIRED_FIELDS:
                    if not user[field]:
                        user_warnings.append(user._fields[field].string)
            message = ""
            if company_warnings:
                message += "\n  ・ ".join(["Missing required company information:"] + company_warnings) + '\n'
            if user_warnings:
                message += "\n  ・ ".join(["Missing required STP Responsible user information:"] + user_warnings)
            report.warning_message = message

    @api.constrains('payslip_ids', 'payslip_batch_id')
    def _check_payslip_batches(self):
        for report in self:
            batch = report.payslip_batch_id
            if any(payslip.payslip_run_id != batch for payslip in report.payslip_ids):
                raise ValidationError(
                    _("All payslips must belong to the same batch."))
            if (
                report.payslip_batch_id
                and report.payslip_ids != report.payslip_batch_id.slip_ids
            ):
                raise ValidationError(
                    _("Some payslips from the batch are missing in the report.")
                )

            # Dont allow the same payslip or batch to be submitted twice
            if (
                report.payevent_type == "submit"
                and self.search(
                    [
                        ("payslip_ids", "in", report.payslip_ids.ids),
                        ("payevent_type", "=", "submit"),
                        ("id", "!=", report.id),
                    ]
                ).exists()
            ):
                raise ValidationError(
                    _(
                        "Payslips cannot be submitted to the ATO twice. Please make an update request for corrections."
                    )
                )

    from .hr_payslip import HrPayslip
    def _get_complex_rendering_data(self, payslips_ids: HrPayslip):
        today = fields.Date.today()
        financial_year = today.year if today.month > 6 else today.year - 1
        start_financial_year = date(financial_year, 7, 1)
        employees = payslips_ids.employee_id

        # == Date and Run Date ==
        if self.payevent_type == "submit":
            run_date = self.payslip_batch_id.payment_report_date or self.create_date
            submit_date = self.payslip_batch_id.payment_report_date or self.create_date
        elif self.payevent_type == "update":
            run_date = self.payslip_batch_id.payment_report_date or self.create_date
            submit_date = self.submit_date or self.create_date
            if self.submit_date < start_financial_year:
                submit_date = start_financial_year

        # == Totals == (may not be reported in an update event)
        line_codes = ["GROSS", "WITHHOLD.TOTAL", "SUPER", "SUPER.CONTRIBUTION", "OTE", "RFBA", "ETP.WITHHOLD", "ETP.TAXABLE", "ETP.TAXFREE"]
        all_line_values = payslips_ids._get_line_values(line_codes, vals_list=['total', 'ytd'])
        mapped_total = {
            code: sum(all_line_values[code][p.id]['total'] for p in payslips_ids) for code in line_codes
        }
        paygw = -mapped_total["WITHHOLD.TOTAL"]
        gross = payslips_ids._get_worked_days_line_amount("WORK100")
        child_garnish = 0.0
        child_withhold = 0.0

        extra_data = {
            "PaymentRecordTransactionD": submit_date.date(),
            "MessageTimestampGenerationDt": run_date.isoformat(),
            "PayAsYouGoWithholdingTaxWithheldA": paygw,
            "TotalGrossPaymentsWithholdingA": gross,
            "ChildSupportGarnisheeA": child_garnish,
            "ChildSupportWithholdingA": child_withhold,
        }
        # Employees extra data
        unknown_date = date(1800, 1, 1)
        min_date = date(1950, 1, 1)
        for employee in employees:
            payslips = payslips_ids.filtered(lambda p: p.employee_id == employee)
            start_date = max(min_date, employee.first_contract_date) or unknown_date
            remunerations = []
            deductions = []
            for payslip in payslips:
                Remuneration = defaultdict(lambda: False)
                worked_lines_ids = payslip.worked_days_line_ids
                input_lines_ids = payslip.input_line_ids
                contract_id = payslip.contract_id
                # == Gross, income type, paygw ==
                Remuneration["IncomeStreamTypeC"] = payslip.l10n_au_income_stream_type
                # == Foreign income == (required for FEI, IAA, WHM )
                if payslip.l10n_au_income_stream_type in ["FEI", "IAA", "WHM"]:
                    Remuneration["AddressDetailsCountryC"] = employee.country_id.code.lower()
                Remuneration["IncomeTaxForeignWithholdingA"] = payslip.l10n_au_foreign_tax_withheld
                Remuneration["IndividualNonBusinessExemptForeignEmploymentIncomeA"] = payslip.l10n_au_exempt_foreign_income
                Remuneration["IncomeTaxPayAsYouGoWithholdingTaxWithheldA"] = -all_line_values["WITHHOLD.TOTAL"][payslip.id]["ytd"]
                Remuneration["GrossA"] = all_line_values["GROSS"][payslip.id]["ytd"]
                # == Paid Leave ==
                leave_lines = worked_lines_ids.filtered(lambda l: l.work_entry_type_id.is_leave)
                Remuneration["PaidLeaveCollection"] = []
                for leave in leave_lines:
                    Remuneration["PaidLeaveCollection"].append({
                        "TypeC": leave.work_entry_type_id.l10n_au_work_stp_code,
                        "PaymentA": float_round(leave.amount, precision_rounding=payslip.currency_id.rounding),
                    })
                leave_inputs = input_lines_ids.filtered(lambda l: l.input_type_id.l10n_au_payment_type == 'leave')
                for leave in leave_inputs:
                    Remuneration["PaidLeaveCollection"].append({
                        "TypeC": leave.l10n_au_payroll_code,
                        "PaymentA": float_round(leave.amount, precision_rounding=payslip.currency_id.rounding),
                    })
                # == Allowance ==
                allowance_lines = input_lines_ids.sudo().filtered(
                    lambda l: l.input_type_id.l10n_au_payment_type == 'allowance' and l.l10n_au_payroll_code not in [
                        'Overtime', False]
                )
                Remuneration["AllowanceCollection"] = []
                for code, allowances in allowance_lines.grouped(lambda l: (l.l10n_au_payroll_code, l.l10n_au_payroll_code_description)).items():
                    Remuneration["AllowanceCollection"].append({
                        "TypeC": code[0],
                        "OtherAllowanceTypeDe": code[1] if code[0] == "OD" else "",
                        "EmploymentAllowancesA": sum(allowances.mapped('amount')),
                    })
                # == Overtime ==
                # overtime_work_entry_type = self.env.ref("hr_work_entry.overtime_work_entry_type")
                overtime_lines = worked_lines_ids.filtered(lambda l: l.work_entry_type_id.l10n_au_work_stp_code == "T")
                overtime_inputs = input_lines_ids.filtered(lambda l: l.l10n_au_payroll_code == "Overtime")
                Remuneration["OvertimePaymentA"] = sum(overtime_lines.mapped("amount") + overtime_inputs.mapped("amount"))

                # == Bonuses and commissions ==
                bonus_commissions_lines = input_lines_ids.filtered(lambda l: l.input_type_id.code == "BBC")
                Remuneration["GrossBonusesAndCommissionsA"] = sum(bonus_commissions_lines.mapped("amount"))
                # == Directors fees ==
                directors_fee_input_type = self.env.ref("l10n_au_hr_payroll.input_gross_director_fee")
                directors_fee = sum(input_lines_ids.filtered(lambda l: l.input_type_id == directors_fee_input_type).mapped('amount'))
                Remuneration["GrossDirectorsFeesA"] = directors_fee
                # == CDEP ==
                # cdep_input_type = self.env.ref("l10n_au_hr_payroll.input_gross_cdep")
                # cdep_lines = input_lines_ids.filtered(lambda l: l.input_type_id == cdep_input_type)
                # Remuneration["IndividualNonBusinessCommunityDevelopmentEmploymentProjectA"] = sum(cdep_lines.mapped("amount"))
                # == Salary sacrifice ==
                if contract_id.l10n_au_salary_sacrifice_superannuation or contract_id.l10n_au_salary_sacrifice_other:
                    Remuneration["SalarySacrificeCollection"] = [
                        {"TypeC": "S", "PaymentA": float_round(contract_id.l10n_au_salary_sacrifice_superannuation, precision_rounding=payslip.currency_id.rounding)},
                        {"TypeC": "O", "PaymentA": float_round(contract_id.l10n_au_salary_sacrifice_other, precision_rounding=payslip.currency_id.rounding)},
                    ]
                # == Lump Sum (Loempia sum) ==
                lump_sum_input_type = input_lines_ids.filtered(lambda l: l.input_type_id.l10n_au_payment_type == 'lump_sum')
                Remuneration["LumpSumCollection"] = []
                for lump_sum in lump_sum_input_type:
                    Remuneration["LumpSumCollection"].append({
                        "TypeC": lump_sum.l10n_au_payroll_code,
                        "PaymentsA": lump_sum.amount,
                    })

                # == Termination Payments ==
                Remuneration["EmploymentTerminationPaymentCollection"] = []
                for code, input_lines in input_lines_ids.filtered(lambda l: l.input_type_id.l10n_au_payment_type == 'etp').grouped(lambda l: l.l10n_au_payroll_code).items():
                    tax_free = input_lines.filtered(lambda l: l.input_type_id.l10n_au_etp_type == "excluded")
                    taxable = input_lines - tax_free
                    Remuneration["EmploymentTerminationPaymentCollection"].append({
                        "IncomePayAsYouGoWithholdingA": abs(all_line_values["ETP.WITHHOLD"][payslip.id]["total"]),
                        "IncomeTaxPayAsYouGoWithholdingTypeC": code,
                        "IncomeD": payslip.paid_date or payslip.date,
                        "IncomeTaxableA": sum(taxable.mapped("amount")),
                        "IncomeTaxFreeA": sum(tax_free.mapped("amount")),
                    })

                # == ETP Leaves ==
                etp_leaves, total = payslip._l10n_au_get_leaves_for_withhold()
                if payslip.l10n_au_termination_type == "normal":
                    leave_amount_u = etp_leaves["annual"]["post_1993"] + etp_leaves["long_service"]["post_1993"]
                    if leave_amount_u:
                        Remuneration["PaidLeaveCollection"].append({
                        "TypeC": "U",
                        "PaymentA": float_round(leave_amount_u, precision_rounding=payslip.currency_id.rounding),
                    })
                    lumpsum_amount_t = etp_leaves["annual"]["pre_1993"] + etp_leaves["long_service"]["pre_1993"]
                    if lumpsum_amount_t:
                        Remuneration["LumpSumCollection"].append({
                            "TypeC": "T",
                            "PaymentsA": float_round(lumpsum_amount_t, precision_rounding=payslip.currency_id.rounding),
                        })
                    lumpsum_amount_b = etp_leaves["long_service"]["pre_1978"]
                    if lumpsum_amount_b:
                        Remuneration["LumpSumCollection"].append({
                            "TypeC": "B",
                            "PaymentsA": float_round(lumpsum_amount_b, precision_rounding=payslip.currency_id.rounding),
                        })
                    assert float_compare(total, leave_amount_u + lumpsum_amount_t + lumpsum_amount_b, precision_rounding=payslip.currency_id.rounding) == 0
                else:
                    # In case of genuine redundancy all are type R
                    if total:
                        Remuneration['LumpSumCollection'].append({
                            "TypeC": "R",
                            "PaymentsA": float_round(total, precision_rounding=payslip.currency_id.rounding),
                        })

                remunerations.append(Remuneration)

                # == DEDUCTIONS ==
                if contract_id.l10n_au_workplace_giving:
                    deductions.append({
                        "RemunerationTypeC": "W",
                        "RemunerationA": contract_id.l10n_au_workplace_giving,
                    })
                if contract_id.employee_id.l10n_au_child_support_garnishee_amount:
                    deductions.append({
                        "RemunerationTypeC": "G",
                        "RemunerationA": contract_id.employee_id.l10n_au_child_support_garnishee_amount,
                    })
                if contract_id.employee_id.l10n_au_child_support_deduction:
                    deductions.append({
                        "RemunerationTypeC": "D",
                        "RemunerationA": contract_id.employee_id.l10n_au_child_support_deduction,
                    })
                for deduction in input_lines_ids.filtered(lambda l: l.input_type_id.l10n_au_payment_type == 'deduction'):
                    deductions.append({
                        "RemunerationTypeC": deduction.l10n_au_payroll_code,
                        "RemunerationA": deduction.amount,
                    })

                # == Super Contribution ==
                contributions = []
                # OTE Entitlement
                ote = all_line_values["OTE"][payslip.id]["ytd"]
                if ote:
                    contributions.append({
                        "EntitlementTypeC": "O",
                        "EmployerContributionsYearToDateA": ote,
                    })
                # Non-Resc
                super_contribution = payslip._get_ytd_super()
                if super_contribution["NON_RESC"]:
                    contributions.append({
                        "EntitlementTypeC": "L",
                        "EmployerContributionsYearToDateA": super_contribution["NON_RESC"],
                    })
                # RESC
                if super_contribution["RESC"]:
                    contributions.append({
                        "EntitlementTypeC": "R",
                        "EmployerContributionsYearToDateA": super_contribution["RESC"],
                    })

                # == Reportable Fringe Benefits ==
                # TODO: Probably has to be ytd according to STP implementation guide
                benefits = []
                rfba = all_line_values["RFBA"][payslip.id]["ytd"]
                if rfba:
                    benefits.append({
                        "FringeBenefitsReportableExemptionC": input_lines_ids.filtered(lambda l: l.code == "RFBA").l10n_au_payroll_code,
                        "A": rfba,
                    })

            employee_data = {
                "EmploymentStartD": start_date,
                "Remuneration": remunerations,
                "Deduction": deductions,
                "contributions": contributions,
                "benefits": benefits,
            }

            extra_data.update({
                employee.id: employee_data
            })

        return extra_data

    def _get_rendering_data(self, payslips_ids: HrPayslip):
        extra_data = self._get_complex_rendering_data(payslips_ids)
        company = self.company_id
        sender = self.company_id.l10n_au_stp_responsible_id
        employer = defaultdict(str, {
            "SoftwareInformationBusinessManagementSystemId": company.l10n_au_bms_id,
            "AustralianBusinessNumberId": company.vat.replace(" ", "") or False,
            "WithholdingPayerNumberId": company.l10n_au_wpn_number if not company.vat else "",
            "OrganisationDetailsOrganisationBranchC": company.l10n_au_branch_code,
            "PreviousSoftwareInformationBusinessManagementSystemId": company.l10n_au_previous_bms_id,
            "DetailsOrganisationalNameT": company.name,
            "PersonUnstructuredNameFullNameT": sender.name,
            "ElectronicMailAddressT": sender.private_email,
            "TelephoneMinimalN": strip_phonenumber(sender.private_phone),
            "PostcodeT": company.zip,
            "CountryC": company.country_id.code.lower(),
            "PaymentRecordTransactionD": extra_data["PaymentRecordTransactionD"],
            "InteractionRecordCt": len(payslips_ids),
            "MessageTimestampGenerationDt": extra_data["MessageTimestampGenerationDt"],
            "InteractionTransactionId": "",  # filled later
            "AmendmentI": "true" if self.ffr else "false",
            "SignatoryIdentifierT": sender.name,
            "SignatureD": date.today(),
            "StatementAcceptedI": "true",
        })
        if self.payevent_type == "submit":
            employer.update({
                "PayAsYouGoWithholdingTaxWithheldA": extra_data["PayAsYouGoWithholdingTaxWithheldA"],
                "TotalGrossPaymentsWithholdingA": extra_data["TotalGrossPaymentsWithholdingA"],
                "ChildSupportGarnisheeA": extra_data["ChildSupportGarnisheeA"],
                "ChildSupportWithholdingA": extra_data["ChildSupportWithholdingA"],
            })

        intermediary = defaultdict(str)
        intermediary_id = False
        if intermediary_id:
            intermediary.update({
                "AustralianBusinessNumberId": intermediary_id.vat,
                "PersonUnstructuredNameFullNameT": intermediary_id.name,
                "ElectronicMailAddressT": intermediary_id.email,
                "TelephoneMinimalN": strip_phonenumber(intermediary_id.phone),
                "SignatoryIdentifierT": intermediary_id.name,
                "SignatureD": False,
                "StatementAcceptedI": False,
            })
        employees = []
        for payslip in payslips_ids:
            employee = payslip.employee_id

            values = defaultdict(str, {
                "TaxFileNumberId": employee.l10n_au_tfn,
                "AustralianBusinessNumberId": employee.l10n_au_abn.replace(" ", "") if employee.l10n_au_abn else "",
                "EmploymentPayrollNumberId": employee.l10n_au_payroll_id or str(employee.id),
                "PreviousPayrollIDEmploymentPayrollNumberId": employee.l10n_au_previous_payroll_id,
                "FamilyNameT": ' '.join(employee.name.split(' ')[1:]),
                "GivenNameT": employee.name.split(' ')[0],
                "OtherGivenNameT": employee.l10n_au_other_names,
                "Dm": employee.birthday.day,
                "M": employee.birthday.month,
                "Y": employee.birthday.year,
                "Line1T": employee.private_street,
                "Line2T": employee.private_street2,
                "LocalityNameT": employee.private_city,
                "StateOrTerritoryC": employee.private_state_id.code,
                "PostcodeT": employee.private_zip,
                "CountryC": employee.private_country_id.code.lower() if employee.private_country_id else False,
                "ElectronicMailAddressT": employee.private_email,
                "TelephoneMinimalN": strip_phonenumber(employee.private_phone),
                "EmploymentStartD": extra_data[employee.id]["EmploymentStartD"],
                "EmploymentEndD": payslip.contract_id.date_end or False,
                "PaymentBasisC": employee.l10n_au_employment_basis_code,
                "CessationTypeC": payslip.contract_id.l10n_au_cessation_type_code,
                "TaxTreatmentC": employee.l10n_au_tax_treatment_code,
                "TaxOffsetClaimTotalA": employee.l10n_au_nat_3093_amount,
                "StartD": payslip.date_from,
                "EndD": payslip.date_to,
                "RemunerationPayrollEventFinalI": str(payslip.struct_id.code == "AUTERM").lower(),
                # Remuneration collection
                "Remuneration": extra_data[employee.id]["Remuneration"],
                # Deductions
                "Deduction": extra_data[employee.id]["Deduction"],
                # Super Contributions
                "SuperannuationContributionCollection": extra_data[employee.id]["contributions"],
                # Fringe Benefits
                "IncomeFringeBenefitsReportableCollection": extra_data[employee.id]["benefits"],
            })
            employees.append(values)

        # sequence at the end to avoid generating if there was an error
        self.submission_id = self.env['ir.sequence'].next_by_code("stp.transaction")
        employer["InteractionTransactionId"] = self.submission_id
        return employer, employees, intermediary

    @staticmethod
    def _prettify_validate_xml(report, schema_file_name):
        root = etree.fromstring(report, parser=etree.XMLParser(remove_blank_text=True, resolve_entities=False))
        xml_string = etree.tostring(root, pretty_print=True, encoding='utf-8', xml_declaration=False)
        payevent_xsd_root = etree.parse(file_path(f"l10n_au_hr_payroll_account/data/{schema_file_name}.xsd"))
        payevent_schema = etree.XMLSchema(payevent_xsd_root)
        try:
            root = etree.fromstring(xml_string)
            payevent_schema.assertValid(root)
            error = ""
        except etree.DocumentInvalid as err:
            error = str(err)
            _logger.error(error)

        return xml_string, error

    def action_generate_xml(self):
        self.ensure_one()
        self._check_stp_fields()
        self._check_payslips()
        self.xml_filename = '%s-PAYEVNT.0004.xml' % (self.name)
        employer, employees, intermediary = self._get_rendering_data(self.payslip_ids)
        delimiter = '<Record_Delimiter DocumentID="{}" DocumentType="{}" DocumentName="{}" RelatedDocumentID="{}"/>\n'
        # The XML file is generated and validated in parts since the employer record and employee records are
        # delimiter separated and do not have a root tag and do not satisfy the XML standards.
        parent_delimiter = delimiter.format('1.1', 'PARENT', 'PAYEVNT', '').encode('utf-8')
        parent_report = self.env['ir.qweb']._render('l10n_au_hr_payroll_account.payevent_0004_xml_report', {'employer': employer, 'intermediary': intermediary})
        parent_report, message = self._prettify_validate_xml(parent_report, 'l10n_au_payevnt_0004')
        report = parent_delimiter + parent_report

        for employee_index, employee in enumerate(employees):
            employee_delimiter = delimiter.format(f'1.{employee_index + 2}', 'CHILD', 'PAYEVNTEMP', '1.1').encode('utf-8')
            employee_report = self.env['ir.qweb']._render('l10n_au_hr_payroll_account.payeventemp_0004_xml_report', {'employee': employee})
            employee_report, error = self._prettify_validate_xml(employee_report, 'l10n_au_payevntemp_0004')
            report += employee_delimiter + employee_report
            message += error

        self.error_message = message
        self.xml_validation_state = "invalid" if message else "done"

        self.xml_file = base64.b64encode(report)

    def _check_stp_fields(self):
        self.ensure_one()
        if self.warning_message:
            raise ValidationError(self.warning_message)
        if not self.company_id.vat and not self.company_id.l10n_au_wpn_number:
            raise ValidationError(_("Please configure the WPN number or ABN in the company settings."))
        if self.company_id.vat and not self.company_id.l10n_au_branch_code:
            raise ValidationError(
                _("Please configure Branch code for %s. Branch code is required for ABN registered companies.", self.company_id.name)
            )

    def _check_payslips(self):
        self.ensure_one()
        if self.payslip_ids.filtered(lambda p: p.l10n_au_stp_status != 'ready'):
            raise ValidationError(_("Some payslips are not ready for STP submission!"))
        if self.payslip_batch_id and self.payslip_batch_id.l10n_au_stp_status != 'ready':
            raise ValidationError(_("The payslip batch is not ready for STP submission!"))

        # Employee fields check
        message = "Please configure the following fields for the employees:\n"
        faulty = False
        for emp in self.payslip_ids.employee_id:
            for field in EMPLOYEE_REQUIRED_FIELDS:
                if not emp[field]:
                    faulty = True
                    message += _("- %(field)s for Employee %(name)s.\n", field=emp._fields[field].string, name=emp.name)
        if faulty:
            raise ValidationError(message)

    def submit(self):
        self.ensure_one()
        self.action_generate_xml()

        if not self.xml_file:
            raise ValidationError(_("The XML file could not be generated!"))

        self.state = 'sent'
        self.activity_feedback(
            ["l10n_au_hr_payroll_account.l10n_au_activity_submit_stp"],
            feedback=f"Submitted to ATO by {self.env.user.name}")


class L10nAuSTPEmp(models.Model):
    _name = "l10n_au.stp.emp"
    _description = "STP Employee"

    employee_id = fields.Many2one(
        "hr.employee", string="Employee", required=True)
    payslip_id = fields.Many2one(
        "hr.payslip", string="Payslip", required=True)
    payslip_currency_id = fields.Many2one(
        "res.currency", related="payslip_id.currency_id", readonly=True)
    stp_id = fields.Many2one(
        "l10n_au.stp", string="Single Touch Payroll")
