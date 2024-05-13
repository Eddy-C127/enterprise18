# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class HrEmployee(models.Model):
    _inherit = "hr.employee"

    billing_rate_target = fields.Float("Billing Rate Target", groups="hr.group_hr_user")
    show_billing_rate_target = fields.Boolean(related="company_id.timesheet_show_rates", groups="hr.group_hr_user")

    @api.model
    def get_billing_rate_target(self, user_ids):
        if self.env.user.has_group("hr_timesheet.group_hr_timesheet_user"):
            return self.sudo().search_read([("user_id", 'in', user_ids)], ["billing_rate_target"])
        return []

    _sql_constraints = [
        (
            "check_billable_rate_target",
            "CHECK(billing_rate_target >= 0 AND billing_rate_target <= 1)",
            "The billing rate target must be between 0 and 100."
        ),
    ]
