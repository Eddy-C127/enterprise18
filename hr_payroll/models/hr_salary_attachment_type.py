# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api
from odoo.exceptions import UserError


class HrSalaryAttachment(models.Model):
    _name = 'hr.salary.attachment.type'
    _description = 'Salary Attachment Type'

    name = fields.Char(required=True, translate=True)
    code = fields.Char(required=True)
    no_end_date = fields.Boolean()
    country_id = fields.Many2one('res.country')
    active = fields.Boolean('Active', default=True)

    @api.constrains('active')
    def _check_salary_attachment_type_active(self):
        if self.env['hr.salary.attachment'].search_count([('deduction_type_id', 'in', self.ids), ('state', 'not in', ('close', 'cancel'))], limit=1):
            raise UserError("You cannot archive a salary attachment type if there exists a running salary attachment of this type.")
