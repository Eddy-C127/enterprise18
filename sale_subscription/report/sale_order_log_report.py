# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import re
from datetime import date

from odoo import api, fields, models, tools
from odoo.osv import expression
from odoo.addons.resource.models.utils import filter_domain_leaf

from odoo.addons.sale_subscription.models.sale_order import SUBSCRIPTION_PROGRESS_STATE, SUBSCRIPTION_STATES



class SaleOrderLogReport(models.Model):
    _name = "sale.order.log.report"
    _description = "Sales Log Analysis Report"
    _order = 'order_id desc, event_date desc, id desc'
    _auto = False

    partner_id = fields.Many2one('res.partner', 'Customer', readonly=True)
    company_id = fields.Many2one('res.company', 'Company', readonly=True)
    user_id = fields.Many2one('res.users', 'Salesperson', readonly=True)
    team_id = fields.Many2one('crm.team', 'Sales Team', readonly=True)
    client_order_ref = fields.Char(string="Customer Reference", readonly=True)
    event_type = fields.Selection(
        string='Type of event',
        selection=[('0_creation', 'New'),
                   ('1_expansion', 'Expansion'),
                   ('15_contraction', 'Contraction'),
                   ('2_churn', 'Churn'),
                   ('3_transfer', 'Transfer')],
        readonly=True
    )
    event_date = fields.Date(readonly=True)
    contract_number = fields.Integer("# Contracts", readonly=True)
    currency_id = fields.Many2one('res.currency', string='Currency', readonly=True)
    pricelist_id = fields.Many2one('product.pricelist', 'Pricelist', readonly=True)
    amount_signed = fields.Float("MRR Change", readonly=True)
    amount_signed_graph = fields.Float("MRR Change (graph)", readonly=True)
    recurring_monthly = fields.Float('Monthly Recurring Revenue', readonly=True)
    recurring_monthly_graph = fields.Float('Monthly Recurring Revenue (graph)', readonly=True)
    recurring_yearly = fields.Float('Annual Recurring Revenue', readonly=True)
    recurring_yearly_graph = fields.Float('Annual Recurring Revenue (graph)', readonly=True)
    template_id = fields.Many2one('sale.order.template', 'Subscription Template', readonly=True)
    recurrence_id = fields.Many2one('sale.temporal.recurrence', 'Recurrence', readonly=True)
    country_id = fields.Many2one('res.country', 'Customer Country', readonly=True)
    industry_id = fields.Many2one('res.partner.industry', 'Customer Industry', readonly=True)
    commercial_partner_id = fields.Many2one('res.partner', 'Customer Entity', readonly=True)
    subscription_state = fields.Selection(SUBSCRIPTION_STATES, readonly=True)
    state = fields.Selection([
        ('draft', 'Draft Quotation'),
        ('sent', 'Quotation Sent'),
        ('sale', 'Sales Order'),
        ('done', 'Sales Done'),
        ('cancel', 'Cancelled'),
    ], string='Status', readonly=True)
    health = fields.Selection([
        ('normal', 'Neutral'),
        ('done', 'Good'),
        ('bad', 'Bad')], string="Health", readonly=True)
    campaign_id = fields.Many2one('utm.campaign', 'Campaign', readonly=True)
    origin_order_id = fields.Many2one('sale.order', 'First Order', readonly=True)
    order_id = fields.Many2one('sale.order', 'Sale Order', readonly=True)
    first_contract_date = fields.Date('First Contract Date', readonly=True)
    end_date = fields.Date(readonly=True)
    close_reason_id = fields.Many2one("sale.order.close.reason", string="Close Reason", readonly=True)

    def _with(self):
        companies = self.env['res.company'].search([], order='id asc')
        main_company_id = companies[:1]
        return f"""
        rate_query AS(
            SELECT currency_id,
                   rcr.name AS rate_date,
                   rcr.rate AS rate_val,
                   MAX(rcr.name) OVER (PARTITION BY currency_id)  AS max_rate_date,
                   rcr.rate
              FROM res_currency_rate rcr
              JOIN res_currency rc ON rc.id= rcr.currency_id
             WHERE rcr.company_id = {main_company_id.id} AND  rcr.name <= CURRENT_DATE
               AND rc.active=true
          ORDER BY rcr.name
        )
        """

    def _select(self):
        select = """
            log.id AS id,
            so.client_order_ref AS client_order_ref,
            log.order_id AS order_id,
            log.event_type AS event_type,
            log.event_date AS event_date,
            log.currency_id AS currency_id,
            so.user_id AS user_id,
            so.team_id AS team_id,
            so.country_id AS country_id,
            so.industry_id AS industry_id,
            so.partner_id AS partner_id,
            so.sale_order_template_id AS template_id,
            so.recurrence_id AS recurrence_id,
            so.health AS health,
            log.company_id,
            partner.commercial_partner_id AS commercial_partner_id,
            so.subscription_state AS subscription_state,
            so.state AS state,
            so.pricelist_id AS pricelist_id,
            log.origin_order_id AS origin_order_id,
            
            log.amount_signed AS amount_signed,
            log.recurring_monthly AS recurring_monthly,
            log.recurring_monthly * 12 AS recurring_yearly,
           
            log.amount_signed * r2.rate/r1.rate AS amount_signed_graph,
            log.amount_signed * r2.rate/r1.rate AS recurring_monthly_graph, -- will be integrated for cumulated values
            log.amount_signed * 12 * r2.rate/r1.rate AS recurring_yearly_graph, -- will be integrated for cumulated values,
            r1.rate AS currency_rate,
            r2.rate AS user_rate,
            log.currency_id AS LOG_cur_id,
            log.company_id AS log_cmp,
            CASE 
                WHEN event_type = '0_creation' THEN 1
                WHEN event_type = '2_churn' THEN -1
                ELSE 0 
            END as contract_number,
            so.campaign_id AS campaign_id,
            so.first_contract_date AS first_contract_date,
            so.end_date AS end_date,
            so.close_reason_id AS close_reason_id
        """
        return select

    def _from(self):
        # To avoid looking at the res_currency table for all records, we build a small table with one line per
        # activated currency. Joining on these values will be faster.
        currency_id = self.env.context.get('mrr_order_currency', self.env.company.currency_id.id)
        return f"""sale_order_log log
                JOIN sale_order so ON so.id=log.order_id
                JOIN res_partner partner ON so.partner_id = partner.id
                LEFT JOIN sale_order_close_reason close ON close.id=so.close_reason_id
                JOIN rate_query r1 ON r1.rate_date=r1.max_rate_date
                                  AND r1.currency_id=log.currency_id
                JOIN rate_query r2 ON r2.rate_date=r2.max_rate_date
                                  AND r2.currency_id={currency_id}
        """

    def _where(self):
        return """
            so.is_subscription
        """

    def _group_by(self):
        return """
            log.id,
            log.order_id,
            log.event_type,
            log.event_date,
            so.name,
            so.client_order_ref,
            so.date_order,
            so.partner_id,
            so.sale_order_template_id,
            so.user_id,
            so.subscription_state,
            so.state,
            so.first_contract_date,
            so.end_date,
            log.origin_order_id,
            so.recurrence_id,
            so.company_id,
            so.health,
            so.campaign_id,
            so.pricelist_id,
            so.currency_rate,
            r1.rate,
            r2.rate,
            so.team_id,
            so.country_id,
            so.industry_id,
            partner.commercial_partner_id,
            log.company_id,
            so.close_reason_id
        """

    @property
    def _table_query(self):
        return self._query()

    def _query(self):
        return f"""
              WITH {self._with()}
            SELECT {self._select()}
              FROM {self._from()}
             WHERE {self._where()}
          GROUP BY {self._group_by()} 
        """

    def action_open_sale_order(self):
        self.ensure_one()
        if self.origin_order_id:
            action = self.order_id._get_associated_so_action()
            action['views'] = [(self.env.ref('sale_subscription.sale_subscription_primary_form_view').id, 'form')]
            orders = self.env['sale.order'].search(['|', ('origin_order_id', '=', self.origin_order_id.id), ('id', '=', self.origin_order_id.id)]).\
                filtered(lambda so: so.subscription_state in SUBSCRIPTION_PROGRESS_STATE + ['churn'])
            order_id = orders and max(orders.ids) or self.order_id.id
            action['res_id'] = order_id
            return action
        return {
            'res_model': self._name,
            'type': 'ir.actions.act_window',
            'views': [[False, "form"]],
            'res_id': self.id,
        }

    def _convert_range_to_datetime(self, group_res):
        if group_res.get('__range'):
            date_strs = re.findall(r'\b[0-9]{4}-[0-9]{2}-[0-9]{2}', str(group_res['__range']))
            min_date = date_strs and min(date_strs)
            max_date = date_strs and max(date_strs)
            return fields.Datetime.from_string(min_date), fields.Datetime.from_string(max_date)
        return None, None


    @api.model
    def read_group(self, domain, fields, groupby, offset=0, limit=None, orderby=False, lazy=True):
        """
            overrides the default read_group in order to amount net, MRR diff in company currency and shift start values.
        """
        currency_id = self.env.company.currency_id
        date_fields = ['event_date']
        baseline_fields = [field for field in ['contract_number', 'recurring_monthly_graph', 'recurring_yearly_graph', 'amount_signed_graph']
                       if ('%s:sum' % field) in fields]
        if any(fv in fields for fv in ['recurring_monthly_graph:sum', 'recurring_yearly_graph:sum']):
            fields += ['amount_signed_graph:sum']
        cumulative_contract = 0
        cumulative_monthly = 0
        cumulative_yearly = 0
        res = super().read_group(domain, fields, groupby, offset=offset, limit=limit, orderby=orderby, lazy=lazy)
        date_domain = any(fv[0] in date_fields for fv in domain)
        if baseline_fields and res and date_domain:
            # Perform a search before the date value to have the groupby base value in cumulative graphs
            min_date, dummy = self._convert_range_to_datetime(res[0])
            if not min_date:
                return res
            domain_without_date = filter_domain_leaf(domain, lambda field: field not in date_fields)
            if expression.TRUE_DOMAIN != domain_without_date:
                # We need to compute the values without date filter to get the cumulative values before our filter
                min_res = super().read_group(domain_without_date, fields, groupby, offset=offset, limit=limit, orderby=orderby, lazy=lazy)
                for val in min_res:
                    val_min_date, dummy = self._convert_range_to_datetime(val)
                    if val_min_date and val_min_date >= min_date:
                        break
                    cumulative_contract += val.get('contract_number', 0) or 0
                    cumulative_monthly += val.get('recurring_monthly_graph', 0) or 0
                    cumulative_yearly += val.get('recurring_yearly_graph', 0) or 0
        if not res:
            return res
        res[0]['contract_number'] = res[0].get('contract_number', 0) + cumulative_contract
        res[0]['recurring_monthly'] = currency_id.round(res[0].get('recurring_monthly_graph', 0) + cumulative_monthly)
        res[0]['recurring_yearly'] = currency_id.round(res[0].get('recurring_yearly_graph', 0) + cumulative_yearly)
        for val in res:
            # Prevent False value to be returned
            contract_number = val.get('contract_number', 0) or 0
            amount_signed = val.get('amount_signed_graph', 0) or 0
            recurring_monthly = val.get('amount_signed_graph', 0) or 0
            recurring_yearly = val.get('amount_signed_graph', 0) or 0
            cumulative_contract += contract_number
            cumulative_monthly += recurring_monthly
            cumulative_yearly += (recurring_yearly * 12)
            val['amount_signed_graph'] = amount_signed
            val['recurring_monthly_graph'] = cumulative_monthly
            val['recurring_yearly_graph'] = cumulative_yearly
            val['contract_number'] = cumulative_contract
        return res
