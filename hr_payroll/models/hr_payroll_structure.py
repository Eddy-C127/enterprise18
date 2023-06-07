#-*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class HrPayrollStructure(models.Model):
    _name = 'hr.payroll.structure'
    _description = 'Salary Structure'

    @api.model
    def _get_default_report_id(self):
        return self.env.ref('hr_payroll.action_report_payslip', False)

    @api.model
    def _get_default_rule_ids(self):
        default_structure = self.env.ref('hr_payroll.default_structure', False)
        if not default_structure or not default_structure.rule_ids:
            return []
        vals = [
            (0, 0, {
                'name': rule.name,
                'sequence': rule.sequence,
                'code': rule.code,
                'category_id': rule.category_id,
                'condition_select': rule.condition_select,
                'condition_python': rule.condition_python,
                'amount_select': rule.amount_select,
                'amount_python_compute': rule.amount_python_compute,
                'appears_on_employee_cost_dashboard': rule.appears_on_employee_cost_dashboard,
            }) for rule in default_structure.rule_ids]
        return vals

    name = fields.Char(required=True)
    code = fields.Char()
    active = fields.Boolean(default=True)
    type_id = fields.Many2one(
        'hr.payroll.structure.type', required=True)
    country_id = fields.Many2one('res.country', string='Country', default=lambda self: self.env.company.country_id)
    note = fields.Html(string='Description')
    rule_ids = fields.One2many(
        'hr.salary.rule', 'struct_id', copy=True,
        string='Salary Rules', default=_get_default_rule_ids)
    report_id = fields.Many2one('ir.actions.report',
        string="Report", domain="[('model','=','hr.payslip'),('report_type','=','qweb-pdf')]", default=_get_default_report_id)
    payslip_name = fields.Char(string="Payslip Name", translate=True,
        help="Name to be set on a payslip. Example: 'End of the year bonus'. If not set, the default value is 'Salary Slip'")
    unpaid_work_entry_type_ids = fields.Many2many(
        'hr.work.entry.type', 'hr_payroll_structure_hr_work_entry_type_rel')
    use_worked_day_lines = fields.Boolean(default=True, help="Worked days won't be computed/displayed in payslips.")
    schedule_pay = fields.Selection([
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('semi-annually', 'Semi-annually'),
        ('annually', 'Annually'),
        ('weekly', 'Weekly'),
        ('bi-weekly', 'Bi-weekly'),
        ('bi-monthly', 'Bi-monthly'),
    ], compute='_compute_schedule_pay', store=True, readonly=False,
    string='Scheduled Pay', index=True,
    help="Defines the frequency of the wage payment.")
    input_line_type_ids = fields.Many2many('hr.payslip.input.type', string='Other Input Line')

    @api.depends('type_id')
    def _compute_schedule_pay(self):
        for structure in self:
            if not structure.type_id:
                structure.schedule_pay = 'monthly'
            elif not structure.schedule_pay:
                structure.schedule_pay = structure.type_id.default_schedule_pay

    @api.returns('self', lambda value: value.id)
    def copy(self, default=None):
        self.ensure_one()
        default = dict(default or {})
        if 'name' not in default:
            default['name'] = _("%s (copy)", self.name)
        return super(HrPayrollStructure, self).copy(default=default)
