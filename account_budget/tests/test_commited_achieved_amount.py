# Part of Odoo. See LICENSE file for full copyright and licensing details.

from .common import TestAccountBudgetCommon
from odoo.tests import tagged
from odoo.fields import Command


@tagged('post_install', '-at_install')
class TestCommittedAchievedAmount(TestAccountBudgetCommon):

    def create_purchase_order_line(self, product, analytic_distribution, qty=10):
        return Command.create({
            'product_id': product.id,
            'analytic_distribution': analytic_distribution,
            'product_qty': qty,
        })

    def create_invoice_line(self, product, analytic_distribution, qty=10, price_unit=100):
        return Command.create({
            'product_id': product.id,
            'analytic_distribution': analytic_distribution,
            'quantity': qty,
            'price_unit': price_unit,
        })

    def test_budget_revenue_committed_achieved_amount(self):
        plan_a_line, plan_b_line, plan_b_admin_line = self.budget_analytic_revenue.budget_line_ids
        self.assertEqual(plan_a_line.achieved_amount, 0)
        self.assertEqual(plan_b_line.achieved_amount, 0)
        self.assertEqual(plan_b_admin_line.achieved_amount, 0)
        purchase_order = self.env['purchase.order'].create({
            'partner_id': self.partner_a.id,
            'date_order': '2019-01-10',
            'order_line': [
                self.create_purchase_order_line(self.product_a, {self.analytic_account_partner_a.id: 100}),
                self.create_purchase_order_line(self.product_a, {"%s,%s" % (self.analytic_account_partner_a.id, self.analytic_account_administratif.id): 100}),
                self.create_purchase_order_line(self.product_b, {self.analytic_account_partner_b.id: 100}),
                self.create_purchase_order_line(self.product_b, {"%s,%s" % (self.analytic_account_partner_b.id, self.analytic_account_administratif.id): 100}),
            ]
        })
        purchase_order.order_line._compute_analytic_json()
        purchase_order.button_confirm()
        purchase_order.write({
            'order_line': [
                Command.update(purchase_order.order_line.sorted()[0].id, {'qty_received': 1}),
                Command.update(purchase_order.order_line.sorted()[1].id, {'qty_received': 3}),
                Command.update(purchase_order.order_line.sorted()[2].id, {'qty_received': 6}),
                Command.update(purchase_order.order_line.sorted()[3].id, {'qty_received': 5}),
            ]
        })
        purchase_order.action_create_invoice()
        invoices = purchase_order.account_move_ids
        invoices.write({'invoice_date': '2019-01-10'})
        invoices.action_post()

        self.env['purchase.order'].invalidate_model(['currency_rate'])
        self.env['purchase.order.line'].invalidate_model(['qty_received', 'qty_invoiced', 'price_unit'])
        self.env['budget.line'].invalidate_model(['achieved_amount', 'committed_amount'])
        # self.budget_analytic_revenue.budget_line_ids._compute_all()

        # Product A have 2 analytic lines, one for invoice line[0] with amount -100 and one for invoice line[1] with amount -300 with account analytic_account_partner_a
        # Achieved = sum(-100, -300) = -400
        self.assertEqual(plan_a_line.achieved_amount, -400.0)

        # Product A have 2 PO lines, one for line[0] with 10 order and 1 received and one for line[1] with 10 order and 3 received with account analytic_account_partner_a
        # Committed = ((order - received) * price) + achieved = ((10-1) + (10-3)) * 100 + (-400) = 1200
        self.assertEqual(plan_a_line.committed_amount, 1200.0)

        # Product B have 2 analytic lines, one for invoice line[2] with amount -600 and one for invoice line[3] with amount -500 with account analytic_account_partner_b
        # Achieved = sum(-600, -500) = -1100
        self.assertEqual(plan_b_line.achieved_amount, -1100.0)

        # Product B have 2 PO lines, one for line[2] with 10 order and 6 received and one for line[3] with 10 order and 5 received with account analytic_account_partner_b
        # Committed = ((order - received) * price) + achieved = ((10-6) + (10-5)) * 100 + (-1100) = -200
        self.assertEqual(plan_b_line.committed_amount, -200.0)

        # Product B have 1 analytic line for invoice line[3] with -500 with analytic_account_partner_b and analytic_account_administratif
        self.assertEqual(plan_b_admin_line.achieved_amount, -500.0)

        # Product B have 1 PO line line[3] with 10 order and 5 received with analytic_account_partner_b and analytic_account_administratif
        # Committed = ((order - received) * price) + achieved = ((10-5) * 100 + (-500) = 0
        self.assertEqual(plan_b_admin_line.committed_amount, 0.0)

    def test_budget_analytic_expense_committed_achieved_amount(self):
        plan_a_line, plan_b_line, plan_b_admin_line = self.budget_analytic_expense.budget_line_ids
        self.assertEqual(plan_a_line.achieved_amount, 0)
        self.assertEqual(plan_b_line.achieved_amount, 0)
        self.assertEqual(plan_b_admin_line.achieved_amount, 0)
        purchase_order = self.env['purchase.order'].create({
            'partner_id': self.partner_a.id,
            'date_order': '2019-01-10',
            'order_line': [
                self.create_purchase_order_line(self.product_a, {self.analytic_account_partner_a.id: 100}),
                self.create_purchase_order_line(self.product_a, {"%s,%s" % (self.analytic_account_partner_a.id, self.analytic_account_administratif.id): 100}),
                self.create_purchase_order_line(self.product_b, {self.analytic_account_partner_b.id: 100}),
                self.create_purchase_order_line(self.product_b, {"%s,%s" % (self.analytic_account_partner_b.id, self.analytic_account_administratif.id): 100}),
            ]
        })
        purchase_order.order_line._compute_analytic_json()
        purchase_order.button_confirm()
        purchase_order.write({
            'order_line': [
                Command.update(purchase_order.order_line.sorted()[0].id, {'qty_received': 1}),
                Command.update(purchase_order.order_line.sorted()[1].id, {'qty_received': 3}),
                Command.update(purchase_order.order_line.sorted()[2].id, {'qty_received': 6}),
                Command.update(purchase_order.order_line.sorted()[3].id, {'qty_received': 5}),
            ]
        })
        purchase_order.action_create_invoice()
        invoices = purchase_order.account_move_ids
        invoices.write({'invoice_date': '2019-01-10'})
        invoices.action_post()

        self.env['purchase.order'].invalidate_model(['currency_rate'])
        self.env['purchase.order.line'].invalidate_model(['qty_received', 'qty_invoiced', 'price_unit'])
        self.env['budget.line'].invalidate_model(['achieved_amount', 'committed_amount'])

        # Product A have 2 analytic lines, one for invoice line[0] with amount 100 and one for invoice line[1] with amount 300 with account analytic_account_partner_a
        # Achieved = sum(100, 300) = 400
        self.assertEqual(plan_a_line.achieved_amount, 400.0)

        # Product A have 2 PO lines, one for line[0] with 10 order and 1 received and one for line[1] with 10 order and 3 received with account analytic_account_partner_a
        # Committed = ((order - received) * price) + achieved = ((10-1) + (10-3)) * 100 + 400 = 2000
        self.assertEqual(plan_a_line.committed_amount, 2000.0)

        # Product B have 2 analytic lines, one for invoice line[2] with amount 600 and one for invoice line[3] with amount 500 with account analytic_account_partner_b
        # Achieved = sum(600, 500) = 1100
        self.assertEqual(plan_b_line.achieved_amount, 1100.0)

        # Product B have 2 PO lines, one for line[2] with 10 order and 6 received and one for line[3] with 10 order and 5 received with account analytic_account_partner_b
        # Committed = ((order - received) * price) + achieved = ((10-6) + (10-5)) * 100 + 1100 = 2000
        self.assertEqual(plan_b_line.committed_amount, 2000.0)

        # Product B have 1 analytic line for invoice line[3] with 500 with analytic_account_partner_b and analytic_account_administratif
        self.assertEqual(plan_b_admin_line.achieved_amount, 500.0)

        # Product B have 1 PO line line[3] with 10 order and 5 received with analytic_account_partner_b and analytic_account_administratif
        # Committed = ((order - received) * price) + achieved = ((10-5) * 100 + 500 = 1000
        self.assertEqual(plan_b_admin_line.committed_amount, 1000.0)
