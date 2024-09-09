# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import models, fields, _


class SaleCommissionReport(models.Model):
    _name = "sale.commission.report"
    _description = "Sales Commission Report"
    _order = 'id'
    _auto = False

    target_id = fields.Many2one('sale.commission.plan.target', "Period", readonly=True)
    target_amount = fields.Float("Target Amount", readonly=True)
    plan_id = fields.Many2one('sale.commission.plan', "Commission Plan", readonly=True)
    user_id = fields.Many2one('res.users', "Sales Person", readonly=True)
    team_id = fields.Many2one('crm.team', "Sales Team", readonly=True)
    achieved = fields.Float("Achieved", readonly=True)
    achieved_rate = fields.Float("Achieved Rate", readonly=True)
    commission = fields.Float("Commission", readonly=True)
    currency_id = fields.Many2one('res.currency', "Currency", readonly=True)
    company_id = fields.Many2one('res.company', string='Company', readonly=True)
    payment_date = fields.Date("Payment Date", readonly=True)

    def action_achievement_detail(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "res_model": "sale.commission.achievement.report",
            "name": _('Commission Detail: %(name)s', name=self.target_id.name),
            "views": [[self.env.ref('sale_commission.sale_achievement_report_view_tree').id, "list"]],
            "context": {'commission_user_ids': self.user_id.ids, 'commission_team_ids': self.team_id.ids},
            "domain": [('target_id', '=', self.target_id.id), ('user_id', '=', self.user_id.id), ('team_id', '=', self.team_id.id)],
        }

    def _currency_rate_query(self):
        """ Return the last (before today) currency rate for every currency, this mean that the currency rate used for
        commission will always be today currency.
        """
        return f"""
currency_rate AS (
    SELECT DISTINCT ON (rc.id)
        rc.id AS currency_id,
        COALESCE(rcr.name, CURRENT_DATE) AS rate_date,
        COALESCE(rcr.rate, 1) AS rate
    FROM res_currency rc
    LEFT JOIN res_currency_rate rcr ON rc.id = rcr.currency_id
    WHERE rc.active = true
      AND (rcr.company_id IS NULL OR (rcr.company_id = {self.env.company.id} AND rcr.name <= CURRENT_DATE))
    ORDER BY rc.id, rcr.name DESC
)"""

    @property
    def _table_query(self):
        users = self.env.context.get('commission_user_ids', [])
        if users:
            users = self.env['res.users'].browse(users).exists()
        teams = self.env.context.get('commission_team_ids', [])
        if teams:
            teams = self.env['crm.team'].browse(teams).exists()
        return f"""
WITH {self.env['sale.commission.achievement.report']._commission_lines_query(users=users, teams=teams)}, {self._currency_rate_query()},
target_com AS (
    SELECT
        amount AS before,
        target_rate AS rate_low,
        LEAD(amount) OVER (PARTITION BY plan_id ORDER BY target_rate) AS amount,
        LEAD(target_rate) OVER (PARTITION BY plan_id ORDER BY target_rate) AS rate_high,
        plan_id
    FROM sale_commission_plan_target_commission scpta
    JOIN sale_commission_plan scp ON scp.id = scpta.plan_id
    WHERE scp.type = 'target'
), achievement AS (
    SELECT
        ROW_NUMBER() OVER (ORDER BY MAX(era.date_to) DESC, user_id) AS id,
        MAX(era.id) AS target_id,
        cl.plan_id AS plan_id,
        cl.user_id AS user_id,
        cl.team_id AS team_id,
        cl.company_id AS company_id,
        SUM(achieved) AS achieved,
        cl.currency_id AS currency_id,
        cl.currency_to AS currency_to,
        MAX(era.amount) AS amount,
        MAX(era.date_to) AS payment_date
    FROM commission_lines cl
    JOIN sale_commission_plan_target era
        ON cl.plan_id = era.plan_id
        AND cl.date >= era.date_from
        AND cl.date <= era.date_to
    GROUP BY
        cl.plan_id,
        cl.user_id,
        cl.team_id,
        cl.company_id,
        cl.currency_id,
        cl.currency_to
), achievement_correct_currency AS (
    SELECT
        MAX(a.id) AS id,
        target_id,
        plan_id,
        user_id,
        team_id,
        company_id,
        payment_date,
        currency_to AS currency_id,
        SUM(achieved * r2.rate / r1.rate) AS achieved,
        MAX(amount) AS amount,
        SUM(achieved * r2.rate / r1.rate) / CASE WHEN MAX(amount) = 0 THEN 1 ELSE MAX(amount) END AS achieved_rate
    FROM achievement a
    JOIN currency_rate r1 ON r1.currency_id = a.currency_id
    JOIN currency_rate r2 ON r2.currency_id = a.currency_to
    GROUP BY
        plan_id,
        user_id,
        team_id,
        target_id,
        company_id,
        payment_date,
        currency_to
), achievement_target AS (
    SELECT
        a.id,
        a.target_id,
        a.plan_id,
        a.user_id,
        a.team_id,
        a.company_id,
        a.payment_date,
        a.currency_id,
        a.achieved,
        a.achieved_rate,
        a.amount AS target_amount,
        CASE
            WHEN tc.before IS NULL THEN a.achieved
            WHEN tc.rate_high IS NULL THEN tc.before
            ELSE tc.before + (tc.amount - tc.before) * (a.achieved_rate - tc.rate_low) / (tc.rate_high - tc.rate_low)
        END AS commission
    FROM achievement_correct_currency a
    LEFT JOIN target_com tc ON (
        tc.plan_id = a.plan_id AND
        tc.rate_low <= a.achieved_rate AND
        (tc.rate_high IS NULL OR tc.rate_high > a.achieved_rate)
    )
)
SELECT * from achievement_target
"""
