# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import models, api


class SaleAchievementReport(models.Model):
    _inherit = "sale.commission.achievement.report"

    @api.model
    def _get_sale_order_log_rates(self):
        return ['mrr']

    @api.model
    def _get_sale_order_log_product(self):
        return """
            rules.mrr_rate * log.amount_signed
        """

    @api.model
    def _get_src_info(self, fname):
        if 'sale_order_log_id' in fname:
            return f"'sale.order.log' AS related_res_model, {fname['sale_order_log_id']} AS related_res_id"
        return super()._get_src_info(fname)

    def _subscription_lines(self, users=None, teams=None):
        return f"""
subscription_rules AS (
    SELECT
        COALESCE(scpu.date_from, scp.date_from) AS date_from,
        COALESCE(scpu.date_to, scp.date_to) AS date_to,
        scpu.user_id AS user_id,
        scpu.team_id AS team_id,
        scp.id AS plan_id,
        scpa.product_id,
        scpa.product_categ_id,
        scp.company_id,
        scp.currency_id AS currency_to,
        scp.user_type = 'team' AS team_rule,
        {self._rate_to_case(self._get_sale_order_log_rates())}
    FROM sale_commission_plan_achievement scpa
    JOIN sale_commission_plan scp ON scp.id = scpa.plan_id
    JOIN sale_commission_plan_user scpu ON scpa.plan_id = scpu.plan_id
    WHERE scp.state = 'approved'
      AND scpa.type IN ({','.join("'%s'" % r for r in self._get_sale_order_log_rates())})
    {'AND scpu.user_id in (%s)' % ','.join(str(i) for i in users.ids) if users else ''}
    {'AND scpu.team_id in (%s)' % ','.join(str(i) for i in teams.ids) if teams else ''}
), subscription_commission_lines_team AS (
    SELECT
        rules.user_id,
        rules.team_id,
        rules.plan_id,
        ({self._get_sale_order_log_product()}) AS achieved,
        log.currency_id,
        rules.currency_to,
        log.event_date AS date,
        rules.company_id,
        {self._get_src_info({'sale_order_log_id': 'log.id'})}
    FROM subscription_rules rules
    JOIN sale_order_log log
      ON log.company_id = rules.company_id
    WHERE rules.team_rule
      AND log.team_id = rules.team_id
    {'AND log.team_id in (%s)' % ','.join(str(i) for i in teams.ids) if teams else ''}
      AND log.event_date BETWEEN rules.date_from AND rules.date_to
), subscription_commission_lines_user AS (
    SELECT
        rules.user_id,
        rules.team_id,
        rules.plan_id,
        ({self._get_sale_order_log_product()}) AS achieved,
        log.currency_id,
        rules.currency_to,
        log.event_date AS date,
        rules.company_id,
        {self._get_src_info({'sale_order_log_id': 'log.id'})}
    FROM subscription_rules rules
    JOIN sale_order_log log
      ON log.company_id = rules.company_id
    WHERE NOT rules.team_rule
      AND log.user_id = rules.user_id
    {'AND log.user_id in (%s)' % ','.join(str(i) for i in users.ids) if users else ''}
      AND log.event_date BETWEEN rules.date_from AND rules.date_to
), subscription_commission_lines AS (
    (SELECT * FROM subscription_commission_lines_team)
    UNION ALL
    (SELECT * FROM subscription_commission_lines_user)
)""", 'subscription_commission_lines'

    def _commission_lines_cte(self, users=None, teams=None):
        return super()._commission_lines_cte(users, teams) + [self._subscription_lines(users, teams)]
