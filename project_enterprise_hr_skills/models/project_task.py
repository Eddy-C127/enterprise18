# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.osv import expression

from odoo.addons.resource.models.utils import filter_domain_leaf

class ProjectTask(models.Model):
    _inherit = "project.task"

    def _get_additional_group_expand_user_ids_domain(self, domain):
        additional_domain = super()._get_additional_group_expand_user_ids_domain(domain)
        skill_search_domain = filter_domain_leaf(domain, lambda field: field == 'user_skill_ids', field_name_mapping={'user_skill_ids': 'name', 'name': 'dummy'})
        if not skill_search_domain:
            return additional_domain
        skill_ids = self.env['hr.skill']._search(skill_search_domain)
        user_skill_read_group = self.env['hr.employee.skill'].sudo()._read_group(
            [('skill_id', 'in', skill_ids)],
            [],
            ['employee_id:array_agg'],
        )
        matching_employee_ids = user_skill_read_group[0][0]
        return expression.AND([
            additional_domain,
            [('employee_id', 'in', matching_employee_ids)],
        ])
