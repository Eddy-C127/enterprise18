# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from odoo.tests import tagged
from .common import TestFsmFlowSaleCommon


@tagged('-at_install', 'post_install')
class TestIndustryFsmTask(TestFsmFlowSaleCommon):

    def test_partner_id_follows_so_shipping_address(self):
        """ For fsm tasks linked to a sale order, the partner_id should be the same as
            the partner_shipping_id set on the sale sale order.
        """
        self.env.user.groups_id += self.env.ref('account.group_delivery_invoice_address')
        so = self.env['sale.order'].create([{
            'name': 'Test SO linked to fsm task',
            'partner_id': self.partner_1.id,
        }])
        sol = self.env['sale.order.line'].create([{
            'name': 'Test SOL linked to a fsm tasl',
            'order_id': so.id,
            'task_id': self.task.id,
            'product_id': self.service_product_delivered.id,
            'product_uom_qty': 3,
        }])
        self.task.sale_line_id = sol
        partner_2 = self.env['res.partner'].create({'name': 'A Test Partner 2'})

        # 1. Modyfing shipping address on SO should update the customer on the task
        self.assertEqual(so.partner_id, self.partner_1)
        self.assertEqual(so.partner_shipping_id, self.partner_1)
        self.assertEqual(self.task.partner_id, self.partner_1)

        so.partner_shipping_id = partner_2

        self.assertEqual(so.partner_id, self.partner_1)
        self.assertEqual(so.partner_shipping_id, partner_2)
        self.assertEqual(self.task.partner_id, partner_2,
                         "Modifying the shipping partner on a sale order linked to a fsm task should update the partner of this task accordingly")

        # 2. partner_id should be False for task not billable
        self.task.project_id.allow_billable = False
        so.partner_shipping_id = partner_2
        self.assertFalse(self.task.partner_id, "Partner id should be set to False for non-billable tasks")
