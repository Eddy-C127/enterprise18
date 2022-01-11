# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from collections import defaultdict
from random import randint
import pytz

from odoo import api, fields, models

class ResourceResource(models.Model):
    _inherit = 'resource.resource'

    def _default_color(self):
        return randint(1, 11)

    color = fields.Integer(default=_default_color)
    avatar_128 = fields.Image(related='employee_id.avatar_128')

    def get_formview_id(self, access_uid=None):
        if self.env.context.get('from_planning'):
            return self.env.ref('planning.resource_resource_with_employee_form_view_inherit', raise_if_not_found=False).id
        return super().get_formview_id(access_uid)

    @api.model_create_multi
    def create(self, vals_list):
        resources = super().create(vals_list)
        if self.env.context.get('from_planning'):
            create_vals = []
            for resource in resources.filtered(lambda r: r.resource_type == 'user'):
                create_vals.append({
                    'name': resource.name,
                    'resource_id': resource.id,
                })
            self.env['hr.employee'].sudo().with_context(from_planning=False).create(create_vals)
        return resources

    def name_get(self):
        result = []
        if self.env.context.get('show_job_title'):
            for resource in self:
                employee = resource.employee_id
                if employee.job_title:
                    result.append((resource.id, "%s (%s)" % (employee.name, employee.job_title)))
                else:
                    result.append((resource.id, resource.name))
        else:
            result = super().name_get()
        return result
