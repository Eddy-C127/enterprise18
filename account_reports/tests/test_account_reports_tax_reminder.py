# -*- coding: utf-8 -*-
from datetime import date
from dateutil.relativedelta import relativedelta
from unittest.mock import patch

from odoo.addons.account_reports.tests.common import TestAccountReportsCommon
from odoo.tests import tagged
from odoo import fields


@tagged('post_install', '-at_install')
class TestAccountReportsTaxReminder(TestAccountReportsCommon):

    def setUp(self):
        super().setUp()

        self.tax_return_move = self.env['account.move'].search([
            ('tax_closing_report_id', '!=', False),
            ('state', '=', 'draft'),
            ('company_id', '=', self.company_data['company'].id),
        ])

        # Force the closing end date in the past to avoid an error
        today = date.today()
        closing_date = today + relativedelta(days=-today.day, months=-1)
        self.tax_return_move.write({
            'date': closing_date,
        })

    def test_posting_adds_a_pay_activity(self):
        ''' Test that posting the tax report move adds a payment activity
        '''
        pay_mat_id = self.env.ref('account_reports.mail_activity_type_tax_report_to_pay')
        pay_mat_domain = [
            ('res_model', '=', self.tax_return_move._name),
            ('res_id', '=', self.tax_return_move.id),
            ('activity_type_id', '=', pay_mat_id.id),
        ]

        # Refreshing the tax entry should not post any mail activity of this type
        self.tax_return_move.refresh_tax_entry()

        self.assertRecordValues(self.tax_return_move, [{'state': 'draft'}])
        act_id = self.env['mail.activity'].search(pay_mat_domain)
        self.assertEqual(len(act_id), 0)

        self.init_invoice(
            'out_invoice',
            partner=self.partner_a,
            invoice_date=self.tax_return_move.date + relativedelta(days=-1),
            post=True,
            amounts=[200],
            taxes=self.tax_sale_a
        )
        self.tax_return_move.refresh_tax_entry()
        # Posting the tax entry should post a mail activity of this type
        report = self.env.ref('account.generic_tax_report')
        with patch.object(self.env.registry[report._name], 'export_to_pdf', autospec=True, side_effect=lambda *args, **kwargs: {'file_name': 'dummy', 'file_content': b'', 'file_type': 'pdf'}):
            self.tax_return_move.action_post()

        self.assertRecordValues(self.tax_return_move, [{'state': 'posted'}])
        self.assertEqual(self.tax_return_move._get_tax_to_pay_on_closing(), 30.0)

        act_id = self.env['mail.activity'].search(pay_mat_domain)
        self.assertEqual(len(act_id), 1)

        self.assertRecordValues(act_id, [{
            'summary': f'Pay tax: {self.tax_return_move.date.strftime("%B %Y")}',
            'date_deadline': fields.Date.context_today(self.env.user),
            'chaining_type': 'suggest',
        }])

        # Posting tax return again should not create another activity
        self.tax_return_move.button_draft()
        self.tax_return_move.refresh_tax_entry()
        with patch.object(self.env.registry[report._name], 'export_to_pdf', autospec=True, side_effect=lambda *args, **kwargs: {'file_name': 'dummy', 'file_content': b'', 'file_type': 'pdf'}):
            self.tax_return_move.action_post()

        act_id = self.env['mail.activity'].search(pay_mat_domain)
        self.assertEqual(len(act_id), 1)

        # 0.0 tax returns don't create an activity
        next_tax_return_move = self.env['account.move'].search([
            ('tax_closing_report_id', '!=', False),
            ('state', '=', 'draft'),
            ('company_id', '=', self.company_data['company'].id),
        ])
        next_tax_return_move.refresh_tax_entry()
        with patch.object(self.env.registry[report._name], 'export_to_pdf', autospec=True, side_effect=lambda *args, **kwargs: {'file_name': 'dummy', 'file_content': b'', 'file_type': 'pdf'}):
            next_tax_return_move.action_post()
        self.assertEqual(next_tax_return_move._get_tax_to_pay_on_closing(), 0.0)
        self.assertFalse(self.env['mail.activity'].search([
            ('res_id', '=', next_tax_return_move.id),
            ('activity_type_id', '=', pay_mat_id.id),
        ]))
