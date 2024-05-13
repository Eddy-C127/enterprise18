# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models


class ResCompany(models.Model):
    _inherit = "res.company"

    timesheet_show_rates = fields.Boolean(export_string_translation=False)
    timesheet_show_leaderboard = fields.Boolean(export_string_translation=False)

    def _get_leaderboard_query(self):
        return """
               SELECT aal.employee_id AS id,
                      he.name,
                      SUM(
                        CASE
                            WHEN aal.timesheet_invoice_type != 'non_billable'
                            THEN aal.unit_amount
                            ELSE 0
                         END
                      ) AS billable_time,
                      SUM(aal.unit_amount) AS total_time,
                      SUM(CASE WHEN aal.date < %s THEN aal.unit_amount ELSE 0 END) AS total_valid_time
                 FROM account_analytic_line AS aal
            LEFT JOIN hr_employee AS he
                   ON aal.employee_id = he.id
                WHERE aal.project_id IS NOT NULL
                  AND date BETWEEN %s AND %s
                  AND he.company_id = %s
                  AND billing_rate_target > 0
             GROUP BY aal.employee_id,
                      he.name
        """

    def _get_leaderboard_data(self, period_start, period_end, today):
        self.ensure_one()
        self.env.cr.execute(self._get_leaderboard_query(), [today, period_start, period_end, self.id])
        return self.env.cr.dictfetchall()

    @api.model
    def get_timesheet_ranking_data(self, period_start, period_end, today, fetch_tip=False):
        period_start, period_end, today = (fields.Date.from_string(d) for d in [period_start, period_end, today])

        data = {
            "leaderboard": self.env.company._get_leaderboard_data(period_start, period_end, today),
            "employee_id": self.env.user.employee_id.id,
            "billing_rate_target": self.env.user.employee_id.billing_rate_target * 100,
            "total_time_target": sum(self.env.user.employee_id.get_daily_working_hours(period_start, period_end)[self.env.user.employee_id.id].values()),
        }

        employees = self.env['hr.employee'].browse([employee["id"] for employee in data["leaderboard"]])
        working_hours = employees.get_daily_working_hours(period_start, period_end)
        for employee in data["leaderboard"]:
            employee["total_time_target"] = sum(working_hours[employee["id"]].values())
            employee["billing_rate"] = employee["billable_time"] / employee["total_time_target"] * 100 if employee["total_time_target"] > 0 else 0

        if fetch_tip:
            data["tip"] = self.env["hr.timesheet.tip"]._get_random_tip() or _("Make it a habit to record timesheets every day.")

        return data
