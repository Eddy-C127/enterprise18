# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.sale_timesheet.tests.common import TestCommonSaleTimesheet
from odoo.fields import Command
from odoo.tests import tagged


@tagged('-at_install', 'post_install')
class TestSaleTimesheetEnterpriseMultiCompany(TestCommonSaleTimesheet):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        Project = cls.env['project.project'].with_context(tracking_disable=True)
        cls.service_timesheet_product = cls.env.ref('sale_timesheet.time_product')
        cls.project_billable_tasks = Project.create({
            'name': "Billable on project",
            'company_id': cls.env.company.id,
            'allow_billable': True,
            'timesheet_product_id': cls.service_timesheet_product.id,
            'partner_id': cls.partner_a.id,
        })

        Task = cls.env['project.task']
        cls.task = Task.with_context(default_project_id=cls.project_billable_tasks.id).create({
            'name': 'first task',
            'partner_id': cls.partner_a.id,
            'allocated_hours': 10,
        })
        cls.env['account.analytic.line'].create({
            'name': 'Test Timesheet',
            'employee_id': cls.employee_manager.id,
            'project_id': cls.project_billable_tasks.id,
            'task_id': cls.task.id,
        })
