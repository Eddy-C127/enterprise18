# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class HrSalaryEmployeeBymonth(models.TransientModel):

    _name = 'hr.salary.employee.month'
    _description = 'Hr Salary Employee By Month Report'

    @api.model
    def default_get(self, field_list=None):
        if self.env.company.country_id.code != "IN":
            raise UserError(_('You must be logged in a Indian company to use this feature'))
        return super().default_get(field_list)

    def _get_employee_domain(self):
        in_companies = self.env.companies.filtered(lambda c: c.country_id.code == 'IN')
        return [('company_id', 'in', in_companies.ids)]

    def _get_default_category(self):
        return self.env['hr.salary.rule.category'].search([('code', '=', 'NET')], limit=1)

    def _get_default_start_date(self):
        year = fields.Date.from_string(fields.Date.today()).strftime('%Y')
        return '{}-01-01'.format(year)

    def _get_default_end_date(self):
        date = fields.Date.from_string(fields.Date.today())
        return date.strftime('%Y') + '-' + date.strftime('%m') + '-' + date.strftime('%d')

    start_date = fields.Date(string='Start Date', required=True, default=_get_default_start_date)
    end_date = fields.Date(string='End Date', required=True, default=_get_default_end_date)
    employee_ids = fields.Many2many('hr.employee', 'payroll_year_rel', 'payroll_year_id', 'employee_id', string='Employees', required=True,
                                    domain=lambda self: self._get_employee_domain())
    category_id = fields.Many2one('hr.salary.rule.category', string='Category', required=True, default=_get_default_category)

    def print_report(self):
        """
         To get the date and print the report
         @return: return report
        """
        self.ensure_one()
        data = {'ids': self.env.context.get('active_ids', [])}
        res = self.read()
        res = res and res[0] or {}
        data.update({'form': res})
        return self.env.ref('l10n_in_hr_payroll.action_report_hrsalarybymonth').with_context(active_model=self._name).report_action(self, data=data)
