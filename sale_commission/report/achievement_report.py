# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import models, api, fields


class SaleAchievementReport(models.Model):
    _name = "sale.commission.achievement.report"
    _description = "Sales Achievement Report"
    _order = 'id'
    _auto = False

    target_id = fields.Many2one('sale.commission.plan.target', "Period", readonly=True)
    plan_id = fields.Many2one('sale.commission.plan', "Commission Plan", readonly=True)
    user_id = fields.Many2one('res.users', "Sales Person", readonly=True)
    team_id = fields.Many2one('crm.team', "Sales Team", readonly=True)
    achieved = fields.Float("Achieved", readonly=True)
    currency_id = fields.Many2one('res.currency', "Currency", readonly=True)
    company_id = fields.Many2one('res.company', string='Company', readonly=True)
    date = fields.Date(string="Date", readonly=True)

    related_res_model = fields.Char(readonly=True)
    related_res_id = fields.Many2oneReference("Related", model_field='related_res_model', readonly=True)

    @property
    def _table_query(self):
        users = self.env.context.get('commission_user_ids', [])
        if users:
            users = self.env['res.users'].browse(users).exists()
        teams = self.env.context.get('commission_team_ids', [])
        if teams:
            teams = self.env['crm.team'].browse(teams).exists()
        return f"""
WITH {self._commission_lines_query(users=users, teams=teams)}
SELECT
    ROW_NUMBER() OVER (ORDER BY MAX(era.date_from) DESC, MAX(era.id)) AS id,
    MAX(era.id) AS target_id,
    MAX(cl.user_id) AS user_id,
    MAX(cl.team_id) AS team_id,
    SUM(cl.achieved) AS achieved,
    MAX(cl.currency_id) AS currency_id,
    MAX(cl.company_id) AS company_id,
    cl.plan_id,
    cl.related_res_model,
    cl.related_res_id,
    MAX(cl.date) AS date
FROM commission_lines cl
JOIN sale_commission_plan_target era
	ON cl.plan_id = era.plan_id
	AND cl.date >= era.date_from
	AND cl.date <= era.date_to
GROUP BY
    cl.related_res_model,
    cl.related_res_id,
    cl.plan_id
"""

    @api.model
    def _rate_to_case(self, rates):
        case = "CASE WHEN scpa.type = '%s' THEN rate ELSE 0 END AS %s"
        return ",\n".join(case % (s, s + '_rate') for s in rates)

    @api.model
    def _get_sale_rates(self):
        return ['amount_sold', 'qty_sold']

    @api.model
    def _get_invoices_rates(self):
        return ['amount_invoiced', 'qty_invoiced']

    @api.model
    def _get_sale_rates_product(self):
        return """
            rules.amount_sold_rate * sol.price_subtotal +
            rules.qty_sold_rate * sol.product_uom_qty
        """

    @api.model
    def _get_invoice_rates_product(self):
        return """
            rules.qty_invoiced_rate * aml.quantity +
            rules.amount_invoiced_rate * aml.price_subtotal
        """

    @api.model
    def _get_src_info(self, fname):
        if 'sale_order_id' in fname:
            return f"'sale.order' AS related_res_model, {fname['sale_order_id']} AS related_res_id"
        elif 'account_move_id' in fname:
            return f"'account.move' AS related_res_model, {fname['account_move_id']} AS related_res_id"
        elif 'achievement_id' in fname:
            return f"'sale.commission.achievement' AS related_res_model, {fname['achievement_id']} AS related_res_id"
        return ''

    @api.model
    def _product_categ_query(self):
        return """
product_categ AS (
    SELECT
        tmpl.categ_id AS categ_id,
        p.id AS pid
    FROM product_product p
    JOIN product_template tmpl ON p.product_tmpl_id = tmpl.id
) """

    def _achievement_lines(self, users=None, teams=None):
        return f"""
achievement_commission_lines AS (
    SELECT
        sca.user_id,
        sca.team_id,
        sca.plan_id,
        sca.achieved,
		sca.currency_id,
		scp.currency_id AS currency_to,
		sca.date,
		scp.company_id,
		{self._get_src_info({'achievement_id': 'sca.id'})}
	FROM sale_commission_achievement sca
	JOIN sale_commission_plan scp ON scp.id = sca.plan_id
	WHERE TRUE
    {'AND sca.user_id in (%s)' % ','.join(str(i) for i in users.ids) if users else ''}
	{'AND sca.team_id in (%s)' % ','.join(str(i) for i in teams.ids) if teams else ''}
)""", 'achievement_commission_lines'

    def _invoices_lines(self, users=None, teams=None):
        return f"""
invoices_rules AS (
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
		{self._rate_to_case(self._get_invoices_rates())}
	FROM sale_commission_plan_achievement scpa
	JOIN sale_commission_plan scp ON scp.id = scpa.plan_id
	JOIN sale_commission_plan_user scpu ON scpa.plan_id = scpu.plan_id
	WHERE scp.state = 'approved'
      AND scpa.type IN ({','.join("'%s'" % r for r in self._get_invoices_rates())})
    {'AND scpu.user_id in (%s)' % ','.join(str(i) for i in users.ids) if users else ''}
    {'AND scpu.team_id in (%s)' % ','.join(str(i) for i in teams.ids) if teams else ''}
), invoice_commission_lines_team AS (
    SELECT
        rules.user_id,
        rules.team_id,
        rules.plan_id,
        ({self._get_invoice_rates_product()}) AS achieved,
		am.currency_id,
		rules.currency_to,
		am.date AS date,
		rules.company_id,
		{self._get_src_info({'account_move_id': 'am.id'})}
    FROM invoices_rules rules
    JOIN account_move am
      ON am.company_id = rules.company_id
    JOIN account_move_line aml
      ON aml.move_id = am.id
    LEFT JOIN product_categ pc
      ON aml.product_id = pc.pid
    WHERE aml.display_type = 'product'
      AND am.move_type = 'out_invoice'
      AND rules.team_rule
      AND am.team_id = rules.team_id
    {'AND am.team_id in (%s)' % ','.join(str(i) for i in teams.ids) if teams else ''}
      AND am.date BETWEEN rules.date_from AND rules.date_to
      AND (rules.product_id IS NULL OR rules.product_id = aml.product_id)
      AND (rules.product_categ_id IS NULL OR rules.product_categ_id = pc.categ_id)
), invoice_commission_lines_user AS (
    SELECT
        rules.user_id,
        rules.team_id,
        rules.plan_id,
        ({self._get_invoice_rates_product()}) AS achieved,
		am.currency_id,
		rules.currency_to,
		am.date AS date,
		rules.company_id,
		{self._get_src_info({'account_move_id': 'am.id'})}
    FROM invoices_rules rules
    JOIN account_move am
      ON am.company_id = rules.company_id
    JOIN account_move_line aml
      ON aml.move_id = am.id
    LEFT JOIN product_categ pc
      ON aml.product_id = pc.pid
    WHERE aml.display_type = 'product'
      AND am.move_type = 'out_invoice'
      AND NOT rules.team_rule
      AND am.invoice_user_id = rules.user_id
    {'AND am.invoice_user_id in (%s)' % ','.join(str(i) for i in users.ids) if users else ''}
      AND am.date BETWEEN rules.date_from AND rules.date_to
      AND (rules.product_id IS NULL OR rules.product_id = aml.product_id)
      AND (rules.product_categ_id IS NULL OR rules.product_categ_id = pc.categ_id)
), invoice_commission_lines AS (
    (SELECT * FROM invoice_commission_lines_team)
    UNION ALL
    (SELECT * FROM invoice_commission_lines_user)
)""", 'invoice_commission_lines'

    def _sale_lines(self, users=None, teams=None):
        return f"""
sale_rules AS (
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
		{self._rate_to_case(self._get_sale_rates())}
	FROM sale_commission_plan_achievement scpa
	JOIN sale_commission_plan scp ON scp.id = scpa.plan_id
	JOIN sale_commission_plan_user scpu ON scpa.plan_id = scpu.plan_id
	WHERE scp.state = 'approved'
      AND scpa.type IN ({','.join("'%s'" % r for r in self._get_sale_rates())})
    {'AND scpu.user_id in (%s)' % ','.join(str(i) for i in users.ids) if users else ''}
    {'AND scpu.team_id in (%s)' % ','.join(str(i) for i in teams.ids) if teams else ''}
), sale_commission_lines_team AS (
    SELECT
        rules.user_id,
        rules.team_id,
        rules.plan_id,
        ({self._get_sale_rates_product()}) AS achieved,
		so.currency_id,
		rules.currency_to,
		so.date_order AS date,
		rules.company_id,
		{self._get_src_info({'sale_order_id': 'so.id'})}
    FROM sale_rules rules
    JOIN sale_order so
      ON so.company_id = rules.company_id
    JOIN sale_order_line sol
      ON sol.order_id = so.id
    LEFT JOIN product_categ pc
      ON sol.product_id = pc.pid
    WHERE sol.display_type IS NULL
      AND rules.team_rule
      AND so.team_id = rules.team_id
    {'AND so.team_id in (%s)' % ','.join(str(i) for i in teams.ids) if teams else ''}
      AND (so.date_order BETWEEN rules.date_from AND rules.date_to)
      AND so.state = 'sale'
      AND (rules.product_id IS NULL OR rules.product_id = sol.product_id)
      AND (rules.product_categ_id IS NULL OR rules.product_categ_id = pc.categ_id)
      AND COALESCE(is_expense, false) = false
      AND COALESCE(is_downpayment, false) = false
), sale_commission_lines_user AS (
    SELECT
        rules.user_id,
        rules.team_id,
        rules.plan_id,
        ({self._get_sale_rates_product()}) AS achieved,
		so.currency_id,
		rules.currency_to,
		so.date_order AS date,
		rules.company_id,
		{self._get_src_info({'sale_order_id': 'so.id'})}
    FROM sale_rules rules
    JOIN sale_order so
      ON so.company_id = rules.company_id
    JOIN sale_order_line sol
      ON sol.order_id = so.id
    LEFT JOIN product_categ pc
      ON sol.product_id = pc.pid
    WHERE sol.display_type IS NULL
      AND NOT rules.team_rule
      AND so.user_id = rules.user_id
    {'AND so.user_id in (%s)' % ','.join(str(i) for i in users.ids) if users else ''}
      AND (so.date_order BETWEEN rules.date_from AND rules.date_to)
      AND so.state = 'sale'
      AND (rules.product_id IS NULL OR rules.product_id = sol.product_id)
      AND (rules.product_categ_id IS NULL OR rules.product_categ_id = pc.categ_id)
      AND COALESCE(is_expense, false) = false
      AND COALESCE(is_downpayment, false) = false
), sale_commission_lines AS (
    (SELECT * FROM sale_commission_lines_team)
    UNION ALL
    (SELECT * FROM sale_commission_lines_user)
)""", 'sale_commission_lines'

    def _commission_lines_cte(self, users=None, teams=None):
        return [self._sale_lines(users, teams), self._invoices_lines(users, teams), self._achievement_lines(users, teams)]

    def _commission_lines_query(self, users=None, teams=None):
        ctes = self._commission_lines_cte(users, teams)
        queries = [x[0] for x in ctes]
        table_names = [x[1] for x in ctes]
        return f"""
{self._product_categ_query()},
{','.join(queries)},
commission_lines AS (
    {' UNION ALL '.join(f'(SELECT * FROM {name})' for name in table_names)}
)
"""
