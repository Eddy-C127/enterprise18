# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.tests import tagged
from odoo import Command
from .gstr_test_json import gstr1_test_json, gstr1_debit_note_test_json
import logging

from odoo.addons.l10n_in_reports.tests.common import L10nInTestAccountReportsCommon

_logger = logging.getLogger(__name__)


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestReports(L10nInTestAccountReportsCommon):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.partner_b.l10n_in_gst_treatment = "regular"

        cls.consumer_partner = cls.partner_a.copy({
            'vat': None,
            'l10n_in_gst_treatment': "consumer",
        })

        cls.deemed_export_partner = cls.partner_a.copy({"l10n_in_gst_treatment": "deemed_export"})
        cls.composition_partner = cls.partner_a.copy({"l10n_in_gst_treatment": "composition"})
        cls.uin_holders_partner = cls.partner_a.copy({"l10n_in_gst_treatment": "uin_holders"})
        cls.large_unregistered_partner = cls.consumer_partner.copy({"state_id": cls.state_in_mh.id, "l10n_in_gst_treatment": "unregistered"})

        cls.partner_foreign.l10n_in_gst_treatment = "overseas"

        cls.comp_sgst_18 = cls._get_company_tax('sgst_sale_18')
        cls.exempt_tax = cls._get_company_tax('exempt_sale')
        cls.nil_rated_tax = cls._get_company_tax('nil_rated_sale')
        cls.non_gst_supplies = cls._get_company_tax('non_gst_supplies_sale')

    def _setup_moves(self, reverse_inv_func):
        b2b_invoice = self._init_inv(partner=self.partner_b, taxes=self.comp_igst_18, line_vals={'price_unit': 500, 'quantity': 2})
        reverse_inv_func(inv=b2b_invoice, line_vals={'quantity': 1})

        b2b_intrastate_invoice = self._init_inv(partner=self.partner_a, taxes=self.comp_sgst_18, line_vals={'price_unit': 500, 'quantity': 2})
        reverse_inv_func(inv=b2b_intrastate_invoice, line_vals={'quantity': 1})

        b2c_intrastate_invoice = self._init_inv(partner=self.consumer_partner, taxes=self.comp_sgst_18, line_vals={'price_unit': 500, 'quantity': 2})
        reverse_inv_func(inv=b2c_intrastate_invoice, line_vals={'quantity': 1})

        b2cl_invoice = self._init_inv(partner=self.large_unregistered_partner, taxes=self.comp_igst_18, line_vals={'price_unit': 250000, 'quantity': 1})
        reverse_inv_func(inv=b2cl_invoice, line_vals={'quantity': 0.5})

        export_invoice = self._init_inv(partner=self.partner_foreign, taxes=self.comp_igst_18, line_vals={'price_unit': 500, 'quantity': 2})
        reverse_inv_func(inv=export_invoice, line_vals={'quantity': 1})

        b2b_invoice_nilratedtax = self._init_inv(partner=self.partner_b, taxes=self.nil_rated_tax, line_vals={'price_unit': 500, 'quantity': 2})
        reverse_inv_func(inv=b2b_invoice_nilratedtax, line_vals={'quantity': 1})

        b2b_invoice_exemptedtax = self._init_inv(partner=self.partner_b, taxes=self.exempt_tax, line_vals={'price_unit': 500, 'quantity': 2})
        reverse_inv_func(inv=b2b_invoice_exemptedtax, line_vals={'quantity': 1})

        b2b_invoice_nongsttax = self._init_inv(partner=self.partner_b, taxes=self.non_gst_supplies, line_vals={'price_unit': 500, 'quantity': 2})
        reverse_inv_func(inv=b2b_invoice_nongsttax, line_vals={'quantity': 1})

        b2b_invoice_deemed_export = self._init_inv(partner=self.deemed_export_partner, taxes=self.comp_igst_18, line_vals={'price_unit': 500, 'quantity': 2})
        reverse_inv_func(inv=b2b_invoice_deemed_export, line_vals={'quantity': 1})  # Creates and posts credit note for the above invoice

        b2b_invoice_composition = self._init_inv(partner=self.composition_partner, taxes=self.comp_igst_18, line_vals={'price_unit': 500, 'quantity': 2})
        reverse_inv_func(inv=b2b_invoice_composition, line_vals={'quantity': 1})

        b2b_invoice_uin_holders = self._init_inv(partner=self.uin_holders_partner, taxes=self.comp_igst_18, line_vals={'price_unit': 500, 'quantity': 2})
        reverse_inv_func(inv=b2b_invoice_uin_holders, line_vals={'quantity': 1})

        # if no tax is applied then it will be out of scope and not considered in GSTR1
        self._init_inv(partner=self.partner_b, taxes=[], line_vals={'price_unit': 500, 'quantity': 2})

        # for b2b invoice with 2 invoice_line_ids having different taxes
        b2b_invoice_gst_and_nil_rated_tax = self._init_inv(partner=self.partner_b, taxes=self.nil_rated_tax, line_vals={'price_unit': 700, 'quantity': 2}, post=False)
        existing_line_vals = b2b_invoice.invoice_line_ids[0].read(['product_id', 'account_id', 'price_unit', 'quantity', 'tax_ids'])[0]
        b2b_invoice_gst_and_nil_rated_tax.write({
            'invoice_line_ids': [
                Command.create({
                    'product_id': existing_line_vals['product_id'][0],
                    'account_id': existing_line_vals['account_id'][0],
                    'price_unit': existing_line_vals['price_unit'],
                    'quantity': existing_line_vals['quantity'],
                    'tax_ids': [(6, 0, existing_line_vals['tax_ids'])],
                })
            ]
        })
        b2b_invoice_gst_and_nil_rated_tax.action_post()

        # b2b invoice with special economic zone
        b2b_sez_invoice_gst_and_nil_rated_tax = b2b_invoice_gst_and_nil_rated_tax.copy(default={'l10n_in_gst_treatment': 'special_economic_zone'})
        b2b_sez_invoice_gst_and_nil_rated_tax.action_post()

    def _create_gstr_report(self, company=None, periodicity='monthly', year=None, month=None):
        return self.env['l10n_in.gst.return.period'].create({
            'company_id': (company or self.default_company).id,
            'periodicity': periodicity,
            'year': year or self.test_date.strftime('%Y'),
            'month': month or self.test_date.strftime('%m'),
        })

    def test_gstr1_json(self):
        self._setup_moves(self._create_credit_note)
        gstr_report = self._create_gstr_report()
        self.assertDictEqual(gstr_report._get_gstr1_json(), gstr1_test_json)

    def test_gstr1_debit_note_json(self):
        self._setup_moves(self._create_debit_note)
        gstr_report = self._create_gstr_report()
        self.assertDictEqual(gstr_report._get_gstr1_json(), gstr1_debit_note_test_json)
