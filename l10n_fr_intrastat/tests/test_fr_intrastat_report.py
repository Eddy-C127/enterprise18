# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import tagged
from odoo.addons.account_reports.tests.common import TestAccountReportsCommon
from odoo import tools

from freezegun import freeze_time


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestFRIntrastatReport(TestAccountReportsCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='fr'):
        super().setUpClass(chart_template_ref=chart_template_ref)
        cls.company_data['company'].country_id = cls.env.ref('base.fr')
        italy = cls.env.ref('base.it')
        cls.company_data['company'].write({
            'vat': 'FR23334175221',
            'siret': '2333417522155555',
            'l10n_fr_intrastat_envelope_id': 'D090',
            'intrastat_region_id': cls.env.ref('l10n_fr_intrastat.intrastat_region_01').id,
        })
        cls.report = cls.env.ref('account_intrastat.intrastat_report')
        cls.report_handler = cls.env['account.intrastat.report.handler']
        cls.partner_a = cls.env['res.partner'].create({
            'name': "Miskatonic University",
            'country_id': italy.id,
            'vat': 'IT12345670017',
        })

        cls.product_aeroplane = cls.env['product.product'].create({
            'name': 'Dornier Aeroplane',
            'intrastat_code_id': cls.env.ref('account_intrastat.commodity_code_2018_88023000').id,
            'intrastat_supplementary_unit_amount': 1,
            'weight': 3739,
            'intrastat_origin_country_id': italy.id,
        })
        cls.product_samples = cls.env['product.product'].create({
            'name': 'Interesting Antarctic Rock and Soil Specimens',
            'intrastat_code_id': cls.env.ref('account_intrastat.commodity_code_2023_25309050').id,
            'weight': 19,
            'intrastat_origin_country_id': italy.id,
        })
        cls.inwards_vendor_bill = cls.env['account.move'].create({
            'move_type': 'in_invoice',
            'partner_id': cls.partner_a.id,
            'invoice_date': '2023-10-15',
            'date': '2023-10-15',
            'intrastat_country_id': italy.id,
            'intrastat_transport_mode_id': cls.env.ref('account_intrastat.account_intrastat_transport_1').id,
            'company_id': cls.company_data['company'].id,
            'invoice_line_ids': [(0, 0, {
                'product_uom_id': cls.env.ref('uom.product_uom_unit').id,
                'intrastat_transaction_id': cls.env.ref('account_intrastat.account_intrastat_transaction_11').id,
                'product_id': cls.product_samples.id,
                'quantity': 42,
                'price_unit': 555.44,
            })],
        })
        cls.outwards_customer_invoice = cls.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': cls.partner_a.id,
            'invoice_date': '2023-10-15',
            'date': '2023-10-15',
            'intrastat_country_id': italy.id,
            'intrastat_transport_mode_id': cls.env.ref('account_intrastat.account_intrastat_transport_1').id,
            'company_id': cls.company_data['company'].id,
            'invoice_line_ids': [(0, 0, {
                'product_uom_id': cls.env.ref('uom.product_uom_unit').id,
                'product_id': cls.product_aeroplane.id,
                'intrastat_transaction_id': cls.env.ref('account_intrastat.account_intrastat_transaction_11').id,
                'quantity': 4,
                'price_unit': 3000.45,
            })],
        })

        cls.outwards_customer_invoice2 = cls.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': cls.partner_a.id,
            'invoice_date': '2023-10-25',
            'date': '2023-10-25',
            'intrastat_country_id': italy.id,
            'intrastat_transport_mode_id': cls.env.ref('account_intrastat.account_intrastat_transport_1').id,
            'company_id': cls.company_data['company'].id,
            'invoice_line_ids': [(0, 0, {
                'product_uom_id': cls.env.ref('uom.product_uom_unit').id,
                'product_id': cls.product_aeroplane.id,
                'intrastat_transaction_id': cls.env.ref('account_intrastat.account_intrastat_transaction_11').id,
                'quantity': 2,
                'price_unit': 10050.1,
            })],
        })

        cls.inwards_vendor_bill.action_post()
        cls.outwards_customer_invoice.action_post()
        cls.outwards_customer_invoice2.action_post()

    @freeze_time('2023-11-01 10:00:00')
    def test_fr_intrastat_export_both_export_types_and_flows(self):
        """ Test generating an XML export when the export type contains both documents (statistical survey and
        vat summary statement) and both export flow for the EMEBI export (arrivals and dispatches)"""
        options = self._generate_options(self.report, '2023-10-01', '2023-10-31')
        arrivals, dispatches = options['intrastat_type']
        arrivals['selected'], dispatches['selected'] = False, False

        wizard = self.env['l10n_fr_intrastat.export.wizard'].create({})
        wizard.export_type = 'statistical_survey_and_vat_summary_statement'
        wizard.emebi_flow = 'arrivals_and_dispatches'
        options['l10n_fr_intrastat_wizard_id'] = wizard.id

        result_xml = self.report_handler.l10n_fr_intrastat_export_to_xml(options)['file_content']
        with tools.file_open('l10n_fr_intrastat/tests/expected_xmls/both_types_flows.xml', 'rb') as expected_xml_file:
            self.assertXmlTreeEqual(
                self.get_xml_tree_from_string(result_xml),
                self.get_xml_tree_from_string(expected_xml_file.read()),
            )

    @freeze_time('2023-11-01 10:00:00')
    def test_fr_intrastat_export_statistical_survey_with_arrival_emebi(self):
        """ Test generating an XML export when the export type contains only the statistical survey and the export
        flow for the EMEBI export is only arrivals"""
        options = self._generate_options(self.report, '2023-10-01', '2023-10-31')
        arrivals, dispatches = options['intrastat_type']
        arrivals['selected'], dispatches['selected'] = False, False

        wizard = self.env['l10n_fr_intrastat.export.wizard'].create({})
        wizard.export_type = 'statistical_survey'
        wizard.emebi_flow = 'arrivals'
        options['l10n_fr_intrastat_wizard_id'] = wizard.id

        result_xml = self.report_handler.l10n_fr_intrastat_export_to_xml(options)['file_content']
        with tools.file_open('l10n_fr_intrastat/tests/expected_xmls/survey_arrival_emebi.xml', 'rb') as expected_xml_file:
            self.assertXmlTreeEqual(
                self.get_xml_tree_from_string(result_xml),
                self.get_xml_tree_from_string(expected_xml_file.read()),
            )

    @freeze_time('2023-11-01 10:00:00')
    def test_fr_intrastat_export_vat_summary_stmt(self):
        """ Test generating an XML export when the export type contains only the vat summary statement"""
        options = self._generate_options(self.report, '2023-10-01', '2023-10-31')
        arrivals, dispatches = options['intrastat_type']
        arrivals['selected'], dispatches['selected'] = False, False

        wizard = self.env['l10n_fr_intrastat.export.wizard'].create({})
        wizard.export_type = 'vat_summary_statement'
        wizard.emebi_flow = 'arrivals_and_dispatches'  # Does not matter in case of vat_summary_statement
        options['l10n_fr_intrastat_wizard_id'] = wizard.id

        result_xml = self.report_handler.l10n_fr_intrastat_export_to_xml(options)['file_content']
        with tools.file_open('l10n_fr_intrastat/tests/expected_xmls/vat_summary_stmt.xml', 'rb') as expected_xml_file:
            self.assertXmlTreeEqual(
                self.get_xml_tree_from_string(result_xml),
                self.get_xml_tree_from_string(expected_xml_file.read()),
            )
