import base64
import csv

from io import StringIO

from odoo import fields, models, _
from odoo.exceptions import UserError, ValidationError
from odoo.tools import format_list
from odoo.tools.misc import format_date
from odoo.addons.hr_payroll.models.hr_employee import _is_iban_valid


class HrPayrollPaymentReportWizard(models.TransientModel):

    _name = 'hr.payroll.payment.report.wizard'
    _description = 'HR Payroll Payment Report Wizard'

    payslip_run_id = fields.Many2one('hr.payslip.run')
    payslip_ids = fields.Many2many('hr.payslip', required=True)
    export_format = fields.Selection([
        ('csv', 'CSV'),
    ], string='Export Format', required=True, default='csv')

    def _create_csv_binary(self):
        output = StringIO()
        report_data = csv.writer(output)
        report_data.writerow([_('Report Date'), _('Payslip Period'), _('Employee name'), _('Employee address'), _('Bank account'), _('Amount to pay')])
        rows = []
        for slip in self.payslip_ids:
            private_address = ' '.join((
                slip.employee_id.private_street or '',
                slip.employee_id.private_street2 or '',
                slip.employee_id.private_zip or '',
                slip.employee_id.private_city or '',
                slip.employee_id.country_id.name or '',
            ))
            rows.append((
                format_date(self.env, fields.Date.today()),
                format_date(self.env, slip.date_from) + ' - ' + format_date(self.env, slip.date_to),
                slip.employee_id.name,
                private_address,
                slip.employee_id.bank_account_id.acc_number,
                str(slip.net_wage) + slip.currency_id.symbol
            ))
        report_data.writerows(rows)
        return base64.encodebytes(output.getvalue().encode())

    def _write_file(self, payment_report, extension):
        if self.payslip_run_id:
            filename = self.payslip_run_id.name
            self.payslip_run_id.write({
                'payment_report': payment_report,
                'payment_report_filename': filename + extension,
                'payment_report_date': fields.Date.today()})
        else:
            filename = self.payslip_ids[0].name

        self.payslip_ids.write({
            'payment_report': payment_report,
            'payment_report_filename': filename + extension,
            'payment_report_date': fields.Date.today()})

    def _perform_checks(self):
        """
        Extend this function and first call super()._perform_checks().
        Then make condition(s) for the format(s) you added and corresponding checks.
        The checks below are common to all payment reports.
        """
        if not self.payslip_ids:
            raise ValidationError(_('There should be at least one payslip to generate the file.'))
        payslips = self.payslip_ids.filtered(lambda p: p.state == "done" and p.net_wage > 0)
        if not payslips:
            raise ValidationError(_('There is no valid payslip (done and net wage > 0) to generate the file.'))

        employees = payslips.employee_id
        no_bank_employee_ids = employees.filtered(lambda e: not e.bank_account_id)
        if no_bank_employee_ids:
            raise UserError(_(
                "Some employees (%s) don't have a bank account.",
                format_list(self.env, no_bank_employee_ids.mapped('name'))))

        untrusted_banks_employee_ids = employees.filtered(lambda e: not e.bank_account_id.allow_out_payment)
        if untrusted_banks_employee_ids:
            raise UserError(_(
                "Untrusted bank account for the following employees:\n%s",
                format_list(self.env, untrusted_banks_employee_ids.mapped('name'))))

        invalid_iban_employee_ids = employees.filtered(lambda e: not _is_iban_valid(e.bank_account_id.acc_number))
        if invalid_iban_employee_ids:
            raise UserError(_(
                'Invalid IBAN for the following employees:\n%s',
                '\n'.join(self.env['hr.employee'].browse(invalid_iban_employee_ids).mapped('name'))))

    def generate_payment_report(self):
        """
        Extend this function and first call super().generate_payment_report().
        Then make condition(s) for the format(s) you added and corresponding methods.
        """
        self.ensure_one()
        self._perform_checks()
        if self.export_format == 'csv':
            payment_report = self._create_csv_binary()
            self._write_file(payment_report, '.csv')
