# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields
from odoo import Command
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.exceptions import UserError
from odoo.tests import tagged
from odoo.tests.common import test_xsd

from lxml import etree


class SDDTestCommon(AccountTestInvoicingCommon):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.env.ref('base.EUR').active = True

        def create_account(number, partner, bank):
            return cls.env['res.partner.bank'].create({
                'acc_number': number,
                'partner_id': partner.id,
                'bank_id': bank.id
            })

        def create_mandate(partner, partner_bank, one_off, company, payment_journal):
            return cls.env['sdd.mandate'].create({
                'name': 'mandate ' + (partner.name or ''),
                'partner_bank_id': partner_bank.id,
                'one_off': one_off,
                'start_date': fields.Date.today(),
                'partner_id': partner.id,
                'company_id': company.id,
                'payment_journal_id': payment_journal.id
            })

        def create_invoice(partner):
            product = cls.env['product.product'].create({'name': 'A Test Product'})
            invoice = cls.env['account.move'].create({
                'move_type': 'out_invoice',
                'partner_id': partner.id,
                'currency_id': cls.env.ref('base.EUR').id,
                'payment_reference': 'invoice to client',
                'invoice_line_ids': [Command.create({
                    'product_id': product.id,
                    'quantity': 1,
                    'price_unit': 42,
                    'name': 'something',
                })],
            })
            invoice.action_post()
            return invoice

        def pay_with_mandate(invoice, mandate):
            sdd_method_line = mandate.payment_journal_id.inbound_payment_method_line_ids.filtered(lambda l: l.code == 'sdd')
            cls.env['account.payment.register'].with_context(active_model='account.move', active_ids=invoice.ids).create({
                'payment_date': invoice.invoice_date_due or invoice.invoice_date,
                'journal_id': mandate.payment_journal_id.id,
                'payment_method_line_id': sdd_method_line.id,
            })._create_payments()

        cls.env.user.email = "ruben.rybnik@sorcerersfortress.com"

        cls.country_belgium, cls.country_china, cls.country_germany = cls.env['res.country'].search([('code', 'in', ['BE', 'CN', 'DE'])], limit=3, order='name ASC')

        # We setup our test company
        cls.sdd_company = cls.env.company
        cls.sdd_company.country_id = cls.country_belgium
        cls.sdd_company.city = 'Company 1 City'
        cls.sdd_company.sdd_creditor_identifier = 'BE30ZZZ300D000000042'
        cls.sdd_company_bank_journal = cls.company_data['default_journal_bank']
        cls.sdd_company_bank_journal.bank_acc_number = 'CH9300762011623852957'
        cls.bank_ing = cls.env['res.bank'].create({'name': 'ING', 'bic': 'BBRUBEBB'})
        cls.bank_bnp = cls.env['res.bank'].create({'name': 'BNP Paribas', 'bic': 'GEBABEBB'})
        cls.bank_no_bic = cls.env['res.bank'].create({'name': 'NO BIC BANK'})
        cls.sdd_company_bank_journal.bank_account_id.bank_id = cls.bank_ing

        # Then we setup the banking data and mandates of two customers (one with a one-off mandate, the other with a recurrent one)
        cls.partner_agrolait = cls.env['res.partner'].create({'name': 'Agrolait', 'city': 'Agrolait Town', 'country_id': cls.country_germany.id})
        cls.partner_bank_agrolait = create_account('DE44500105175407324931', cls.partner_agrolait, cls.bank_ing)
        cls.mandate_agrolait = create_mandate(cls.partner_agrolait, cls.partner_bank_agrolait, False, cls.sdd_company, cls.sdd_company_bank_journal)
        cls.mandate_agrolait.action_validate_mandate()

        cls.partner_china_export = cls.env['res.partner'].create({'name': 'China Export', 'city': 'China Town', 'country_id': cls.country_china.id})
        cls.partner_bank_china_export = create_account('SA0380000000608010167519', cls.partner_china_export, cls.bank_bnp)
        cls.mandate_china_export = create_mandate(cls.partner_china_export, cls.partner_bank_china_export, True, cls.sdd_company, cls.sdd_company_bank_journal)
        cls.mandate_china_export.action_validate_mandate()

        cls.partner_no_bic = cls.env['res.partner'].create({'name': 'NO BIC Co', 'city': 'NO BIC City', 'country_id': cls.country_belgium.id})
        cls.partner_bank_no_bic = create_account('BE68844010370034', cls.partner_no_bic, cls.bank_no_bic)
        cls.mandate_no_bic = create_mandate(cls.partner_no_bic, cls.partner_bank_no_bic, True, cls.sdd_company, cls.sdd_company_bank_journal)
        cls.mandate_no_bic.action_validate_mandate()

        # Finally, we create one invoice for each of our test customers ...
        cls.invoice_agrolait = create_invoice(cls.partner_agrolait)
        cls.invoice_china_export = create_invoice(cls.partner_china_export)
        cls.invoice_no_bic = create_invoice(cls.partner_no_bic)

        # Pay the invoices with mandates
        pay_with_mandate(cls.invoice_agrolait, cls.mandate_agrolait)
        pay_with_mandate(cls.invoice_china_export, cls.mandate_china_export)
        pay_with_mandate(cls.invoice_no_bic, cls.mandate_no_bic)


@tagged('post_install', '-at_install')
class SDDTest(SDDTestCommon):
    def test_sdd(self):
        # The invoices should have been paid thanks to the mandate
        self.assertEqual(self.invoice_agrolait.payment_state, self.env['account.move']._get_invoice_in_payment_state(), 'This invoice should have been paid thanks to the mandate')
        self.assertEqual(self.invoice_agrolait.sdd_mandate_id, self.mandate_agrolait)
        self.assertEqual(self.invoice_china_export.payment_state, self.env['account.move']._get_invoice_in_payment_state(), 'This invoice should have been paid thanks to the mandate')
        self.assertEqual(self.invoice_china_export.sdd_mandate_id, self.mandate_china_export)
        self.assertEqual(self.invoice_no_bic.payment_state, self.env['account.move']._get_invoice_in_payment_state(), 'This invoice should have been paid thanks to the mandate')
        self.assertEqual(self.invoice_no_bic.sdd_mandate_id, self.mandate_no_bic)

        # The 'one-off' mandate should now be closed
        self.assertEqual(self.mandate_agrolait.state, 'active', 'A recurrent mandate should stay confirmed after accepting a payment')
        self.assertEqual(self.mandate_china_export.state, 'closed', 'A one-off mandate should be closed after accepting a payment')
        self.assertEqual(self.mandate_no_bic.state, 'closed', 'A one-off mandate should be closed after accepting a payment')

    def test_xml_pain_008_001_08_generation(self):
        self.sdd_company_bank_journal.debit_sepa_pain_version = 'pain.008.001.08'

        for invoice in (self.invoice_agrolait, self.invoice_no_bic):
            payment = invoice.line_ids.mapped('matched_credit_ids.credit_move_id.payment_id')
            payment.generate_xml(self.sdd_company, fields.Date.today(), True)

        payment = self.invoice_china_export.line_ids.mapped('matched_credit_ids.credit_move_id.payment_id')

        # Checks that an error is thrown if the country name or the city name is missing
        self.partner_china_export.write({'city': 'China Town', 'country_id': False})
        with self.assertRaises(UserError):
            payment.generate_xml(self.sdd_company, fields.Date.today(), True)

        self.partner_china_export.write({'city': False, 'country_id': self.country_china})
        with self.assertRaises(UserError):
            payment.generate_xml(self.sdd_company, fields.Date.today(), True)

        # Checks that the xml is correctly generated when both the city_name and country are set
        self.partner_china_export.write({'city': 'China Town', 'country_id': self.country_china})
        payment.generate_xml(self.sdd_company, fields.Date.today(), True)


@tagged('external_l10n', 'post_install', '-at_install', '-standard')
class SDDTestXML(SDDTestCommon):
    @test_xsd(path='account_sepa_direct_debit/schemas/pain.008.001.02.xsd')
    def test_xml_pain_008_001_02_generation(self):
        self.sdd_company_bank_journal.debit_sepa_pain_version = 'pain.008.001.02'

        xml_files = []
        for invoice in (self.invoice_agrolait, self.invoice_china_export, self.invoice_no_bic):
            payment = invoice.line_ids.mapped('matched_credit_ids.credit_move_id.payment_id')
            xml_files.append(etree.fromstring(payment.generate_xml(self.sdd_company, fields.Date.today(), True)))
        return xml_files

    @test_xsd(path='account_sepa_direct_debit/schemas/EPC131-08_2019_V1.0_pain.008.001.02.xsd')
    def test_xml_pain_008_001_02_b2b_generation(self):
        self.sdd_company_bank_journal.debit_sepa_pain_version = 'pain.008.001.02'
        self.mandate_agrolait.sdd_scheme = 'B2B'
        self.mandate_china_export.sdd_scheme = 'B2B'
        self.mandate_no_bic.sdd_scheme = 'B2B'

        xml_files = []
        for invoice in (self.invoice_agrolait, self.invoice_china_export, self.invoice_no_bic):
            payment = invoice.line_ids.mapped('matched_credit_ids.credit_move_id.payment_id')
            xml_files.append(etree.fromstring(payment.generate_xml(self.sdd_company, fields.Date.today(), True)))
        return xml_files

    @test_xsd(path='account_sepa_direct_debit/schemas/pain.008.001.08.xsd')
    def test_xml_pain_008_001_08_generation(self):
        self.sdd_company_bank_journal.debit_sepa_pain_version = 'pain.008.001.08'

        xml_files = []
        for invoice in (self.invoice_agrolait, self.invoice_china_export, self.invoice_no_bic):
            payment = invoice.line_ids.mapped('matched_credit_ids.credit_move_id.payment_id')
            xml_files.append(etree.fromstring(payment.generate_xml(self.sdd_company, fields.Date.today(), True)))

        return xml_files
