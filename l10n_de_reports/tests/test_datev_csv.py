# -*- coding: utf-8 -*-
from odoo import fields
from odoo.tests import tagged
from odoo.tools import pycompat
import io

from odoo.addons.account.tests.common import AccountTestInvoicingCommon



@tagged('post_install_l10n', 'post_install', '-at_install')
class TestDatevCSV(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref='l10n_de_skr03.l10n_de_chart_template')

        cls.account_3400 = cls.env['account.account'].search([
            ('code', '=', 3400),
            ('company_id', '=', cls.company_data['company'].id),
        ], limit=1)
        cls.account_4980 = cls.env['account.account'].search([
            ('code', '=', 4980),
            ('company_id', '=', cls.company_data['company'].id),
        ], limit=1)
        cls.tax_19 = cls.env['account.tax'].search([
            ('name', '=', '19% Vorsteuer'),
            ('company_id', '=', cls.company_data['company'].id),
        ], limit=1)

    def test_datev_in_invoice(self):
        report = self.env['account.general.ledger']
        options = report._get_options()
        options['date'].update({
            'date_from': '2020-01-01',
            'date_to': '2020-12-31',
        })

        move = self.env['account.move'].create([{
            'move_type': 'in_invoice',
            'partner_id': self.env['res.partner'].create({'name': 'Res Partner 12'}).id,
            'invoice_date': fields.Date.to_date('2020-12-01'),
            'name': 'BILL/2020/12/0001',
            'invoice_line_ids': [
                (0, None, {
                    'price_unit': 100,
                    'account_id': self.account_3400.id,
                    'tax_ids': [(6, 0, self.tax_19.ids)],
                }),
                (0, None, {
                    'price_unit': 100,
                    'account_id': self.account_3400.id,
                    'tax_ids': [(6, 0, self.tax_19.ids)],
                }),
                (0, None, {
                    'price_unit': 100,
                    'account_id': self.account_4980.id,
                    'tax_ids': [(6, 0, self.tax_19.ids)],
                }),
            ]
        }])
        move.action_post()

        reader = pycompat.csv_reader(io.BytesIO(report.get_csv(options)), delimiter=';', quotechar='"', quoting=2)
        data = [[x[0], x[1], x[2], x[6], x[7], x[8], x[9], x[10], x[13]] for x in reader][2:]
        self.assertEqual(2, len(data), "csv should have 2 lines")
        self.assertIn(['238,00', 's', 'EUR', '34000000', str(move.partner_id.id + 700000000), '19', '112',
                       'BILL/2020/12/0001', 'BILL/2020/12/0001'], data)
        self.assertIn(['119,00', 's', 'EUR', '49800000', str(move.partner_id.id + 700000000), '19', '112',
                       'BILL/2020/12/0001', 'BILL/2020/12/0001'], data)

    def test_datev_out_invoice(self):
        report = self.env['account.general.ledger']
        options = report._get_options()
        options['date'].update({
            'date_from': '2020-01-01',
            'date_to': '2020-12-31',
        })

        move = self.env['account.move'].create([{
            'move_type': 'out_invoice',
            'partner_id': self.env['res.partner'].create({'name': 'Res Partner 12'}).id,
            'invoice_date': fields.Date.to_date('2020-12-01'),
            'name': 'INV/2020/12/0001',
            'invoice_line_ids': [
                (0, None, {
                    'price_unit': 100,
                    'account_id': self.account_4980.id,
                    'tax_ids': [(6, 0, self.tax_19.ids)],
                }),
            ]
        }])
        move.action_post()

        reader = pycompat.csv_reader(io.BytesIO(report.get_csv(options)), delimiter=';', quotechar='"', quoting=2)
        data = [[x[0], x[1], x[2], x[6], x[7], x[8], x[9], x[10], x[13]] for x in reader][2:]
        self.assertEqual(1, len(data), "csv should have 1 line")
        self.assertIn(['119,00', 'h', 'EUR', '49800000', str(move.partner_id.id + 100000000), '19', '112',
                       'INV/2020/12/0001', 'INV/2020/12/0001'], data)

    def test_datev_miscellaneous(self):
        report = self.env['account.general.ledger']
        options = report._get_options()
        options['date'].update({
            'date_from': '2020-01-01',
            'date_to': '2020-12-31',
        })

        move = self.env['account.move'].create({
            'move_type': 'entry',
            'date': '2020-12-01',
            'journal_id': self.company_data['default_journal_misc'].id,
            'name': 'MISC/2020/12/0001',
            'line_ids': [
                (0, 0, {
                    'debit': 100,
                    'credit': 0,
                    'partner_id': self.partner_a.id,
                    'account_id': self.account_4980.id,
                }),
                (0, 0, {
                    'debit': 0,
                    'credit': 100,
                    'partner_id': self.partner_a.id,
                    'account_id': self.account_3400.id,
                }),
            ]
        })
        move.action_post()

        reader = pycompat.csv_reader(io.BytesIO(report.get_csv(options)), delimiter=';', quotechar='"', quoting=2)
        data = [[x[0], x[1], x[2], x[6], x[7], x[9], x[10], x[13]] for x in reader][2:]
        self.assertEqual(1, len(data), "csv should have 1 lines")
        self.assertIn(['100,00', 'h', 'EUR', '34000000', '49800000', '112', 'MISC/2020/12/0001', 'MISC/2020/12/0001'], data)

    def test_datev_out_invoice_payment(self):
        report = self.env['account.general.ledger']
        options = report._get_options()
        options['date'].update({
            'date_from': '2020-01-01',
            'date_to': '2020-12-31',
        })

        move = self.env['account.move'].create([{
            'move_type': 'out_invoice',
            'partner_id': self.env['res.partner'].create({'name': 'Res Partner 12'}).id,
            'invoice_date': fields.Date.to_date('2020-12-01'),
            'name': 'INV/2020/12/0001',
            'invoice_line_ids': [
                (0, None, {
                    'price_unit': 100,
                    'account_id': self.account_4980.id,
                    'tax_ids': [(6, 0, self.tax_19.ids)],
                }),
            ]
        }])
        move.action_post()

        pay = self.env['account.payment.register'].with_context(active_model='account.move', active_ids=move.ids).create({
            'payment_date': fields.Date.to_date('2020-12-03'),
        })._create_payments()

        reader = pycompat.csv_reader(io.BytesIO(report.get_csv(options)), delimiter=';', quotechar='"', quoting=2)
        data = [[x[0], x[1], x[2], x[6], x[9], x[10], x[13]] for x in reader][2:]
        self.assertIn(['119,00', 'h', 'EUR', str(move.partner_id.id + 100000000), '312', pay.name,
                       pay.name], data)

    def test_datev_in_invoice_payment(self):
        report = self.env['account.general.ledger']
        options = report._get_options()
        options['date'].update({
            'date_from': '2020-01-01',
            'date_to': '2020-12-31',
        })

        move = self.env['account.move'].create([{
            'move_type': 'in_invoice',
            'partner_id': self.env['res.partner'].create({'name': 'Res Partner 12'}).id,
            'invoice_date': fields.Date.to_date('2020-12-01'),
            'name': 'BILL/2020/12/0001',
            'invoice_line_ids': [
                (0, None, {
                    'price_unit': 100,
                    'account_id': self.account_4980.id,
                    'tax_ids': [(6, 0, self.tax_19.ids)],
                }),
            ]
        }])
        move.action_post()

        pay = self.env['account.payment.register'].with_context(active_model='account.move', active_ids=move.ids).create({
            'payment_date': fields.Date.to_date('2020-12-03'),
        })._create_payments()

        reader = pycompat.csv_reader(io.BytesIO(report.get_csv(options)), delimiter=';', quotechar='"', quoting=2)
        data = [[x[0], x[1], x[2], x[6], x[9], x[10], x[13]] for x in reader][2:]
        self.assertIn(['119,00', 's', 'EUR', str(move.partner_id.id + 700000000), '312', pay.name,
                       pay.name], data)
