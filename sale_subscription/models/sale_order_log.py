# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.addons.sale_subscription.models.sale_order import SUBSCRIPTION_STATES, SUBSCRIPTION_DRAFT_STATE, SUBSCRIPTION_PROGRESS_STATE


class SaleOrderLog(models.Model):
    _name = 'sale.order.log'
    _description = 'Sale Order Log'
    _order = 'event_date desc, id desc'

    # Order related
    order_id = fields.Many2one(
        'sale.order', string='Sale Order',
        required=True, ondelete='cascade', readonly=True,
        auto_join=True
    )
    user_id = fields.Many2one('res.users', related='order_id.user_id', string='Salesperson', store=True, precompute=True, depends=[])
    team_id = fields.Many2one('crm.team', related='order_id.team_id', string='Sales Team', store=True, precompute=True, depends=[])
    company_id = fields.Many2one('res.company', related='order_id.company_id', string='Company', store=True, precompute=True, depends=[])
    currency_id = fields.Many2one('res.currency', related='order_id.currency_id', string='Currency', store=True, precompute=True, depends=[], readonly=False)
    origin_order_id = fields.Many2one('sale.order', string='Origin Contract', store=True, index=True, precompute=True,
                                      compute='_compute_origin_order_id')

    event_type = fields.Selection(
        string='Type of event',
        selection=[('0_creation', 'New'),
                   ('1_expansion', 'Expansion'),
                   ('15_contraction', 'Contraction'),
                   ('2_churn', 'Churn'),
                   ('3_transfer', 'Transfer')],
        required=True,
        readonly=True,
        index=True,
    )
    event_date = fields.Date(string='Event Date', required=True, index=True, default=fields.Date.today)
    recurring_monthly = fields.Monetary(string='New MRR', required=True,
                                        help="MRR, after applying the changes of that particular event", readonly=True)
    amount_signed = fields.Monetary(string='MRR change', required=True, readonly=True)
    subscription_state = fields.Selection(selection=SUBSCRIPTION_STATES, help="Subscription stage when the change occurred")


    @api.depends('order_id')
    def _compute_origin_order_id(self):
        for log in self:
            log.origin_order_id = log.order_id.origin_order_id or log.order_id

    #######################
    #       LOG GEN       #
    #######################

    @api.model
    def _create_log(self, order, initial_values):
        if order.state == 'cancel' and order.order_log_ids:
            return self._cancel_logs(order, initial_values)
        if (order.subscription_state not in SUBSCRIPTION_PROGRESS_STATE and
            initial_values.get('subscription_state') not in SUBSCRIPTION_PROGRESS_STATE):
            return self.env['sale.order.log']
        if ('subscription_state' not in initial_values or
            ((initial_values['subscription_state'] in SUBSCRIPTION_PROGRESS_STATE) ==
             (order.subscription_state in SUBSCRIPTION_PROGRESS_STATE))):
            if 'currency_id' in initial_values and initial_values['currency_id'] != order.currency_id:
                return self._create_currency_log(order, initial_values)
            return self._create_mrr_log(order, initial_values)
        else:
            return self._create_stage_log(order, initial_values)

    @api.model
    def _cancel_logs(self, order, initial_values):
        order.order_log_ids.unlink()
        if initial_values.get('subscription_state', '1_draft') in SUBSCRIPTION_DRAFT_STATE + SUBSCRIPTION_PROGRESS_STATE and order.subscription_id:
            parent_last_log = max(order.subscription_id.order_log_ids, key=lambda log: (log.event_date, log.id))
            if parent_last_log.event_type == '3_transfer' and parent_last_log.amount_signed < 0:
                parent_last_log.unlink()
        return self.env['sale.order.log']

    @api.model
    def _create_currency_log(self, order, initial_values):
        new_mrr = max(order.recurring_monthly, 0)
        old_mrr = max(initial_values.get('recurring_monthly', 0), 0)

        return self.create([{
            'order_id': order.id,
            'event_type': '3_transfer',
            'amount_signed': -old_mrr,
            'currency_id': initial_values['currency_id'].id,
            'recurring_monthly': 0,
            'subscription_state': initial_values.get('subscription_state', order.subscription_state),
        }, {
            'order_id': order.id,
            'event_type': '3_transfer',
            'amount_signed': new_mrr,
            'recurring_monthly': new_mrr,
            'subscription_state': initial_values.get('subscription_state', order.subscription_state),
        }])

    @api.model
    def _create_mrr_log(self, order, initial_values):
        new_mrr = max(order.recurring_monthly, 0)
        old_mrr = max(initial_values.get('recurring_monthly', 0), 0)
        if order.currency_id.compare_amounts(old_mrr, new_mrr) == 0:
            return self.env['sale.order.log']

        return self.create({
            'order_id': order.id,
            'event_type': '1_expansion' if new_mrr > old_mrr else '15_contraction',
            'amount_signed': new_mrr - old_mrr,
            'recurring_monthly': new_mrr,
            'subscription_state': order.subscription_state,
        })

    @api.model
    def _create_stage_log(self, order, initial_values):
        old_state = initial_values.get('subscription_state', '1_draft') or '1_draft'
        new_state = order.subscription_state
        if new_state in SUBSCRIPTION_PROGRESS_STATE:
            if old_state == '1_draft':
                return self._create_new_log(order, initial_values)
            elif old_state == '2_renewal':
                return self._create_renewal_log(order, initial_values)
            elif old_state == '6_churn':
                return self._create_reopen_log(order, initial_values)
        elif old_state in SUBSCRIPTION_PROGRESS_STATE:
            if new_state == '6_churn':
                return self._create_churn_log(order, initial_values)

    @api.model
    def _create_new_log(self, order, initial_values):
        return self.create({
            'order_id': order.id,
            'event_type': '0_creation',
            'amount_signed': max(order.recurring_monthly, 0),
            'recurring_monthly': max(order.recurring_monthly, 0),
            'subscription_state': initial_values.get('subscription_state', '1_draft'),
        })

    @api.model
    def _create_renewal_log(self, order, initial_values):
        result = self.env['sale.order.log']
        parent_order = order.subscription_id
        parent_churn = parent_order.order_log_ids.filtered(lambda log: log.event_type == '2_churn')
        if parent_order.next_invoice_date != order.start_date:
            if not parent_churn:
                result += self._create_churn_log(parent_order, {})
            return self._create_new_log(order, initial_values) + result
        else:
            parent_churn[:1].unlink()

        parent_log = self._create_parent_renewal_log(parent_order)
        if not parent_log:
            return self._create_new_log(order, initial_values)
        transfer_amount = parent_log.currency_id._convert(-parent_log.amount_signed,
                                                          to_currency=order.currency_id,
                                                          company=order.company_id, round=False)
        result += self.create({
            'order_id': order.id,
            'event_type': '3_transfer',
            'amount_signed': transfer_amount,
            'recurring_monthly': transfer_amount,
            'subscription_state': initial_values.get('subscription_state', order.subscription_state),
        })
        if order.recurring_monthly != transfer_amount:
            initial_values['recurring_monthly'] = transfer_amount
            result += self._create_mrr_log(order, initial_values)

        return parent_log + result

    @api.model
    def _create_parent_renewal_log(self, parent_order):
        if not parent_order.order_log_ids:
            return self.env['sale.order.log']
        transfer_amount = sum(parent_order.order_log_ids.mapped('amount_signed'))
        return self.create({
            'order_id': parent_order.id,
            'event_type': '3_transfer',
            'amount_signed': -transfer_amount,
            'recurring_monthly': 0,
            'subscription_state': parent_order.subscription_state,
        })

    @api.model
    def _create_reopen_log(self, order, initial_values):
        churn_log = order.order_log_ids.filtered(lambda log: log.event_type == '2_churn')
        if churn_log:
            churn_log.unlink()
            last_recurring_monthly = sum(order.order_log_ids.mapped('amount_signed'))
            initial_values['recurring_monthly'] = last_recurring_monthly
            return self._create_mrr_log(order, initial_values)

    @api.model
    def _create_churn_log(self, order, initial_values):
        return self.create({
            'order_id': order.id,
            'event_type': '2_churn',
            'amount_signed': -initial_values.get('recurring_monthly', order.recurring_monthly),
            'recurring_monthly': 0,
            'subscription_state': initial_values.get('subscription_state', order.subscription_state),
        })
