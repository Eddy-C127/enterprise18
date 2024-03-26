from odoo import Command
from odoo.addons.account_reports.tests.common import TestAccountReportsCommon
from odoo.tests import tagged


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestAccountMaExport(TestAccountReportsCommon):
    @classmethod
    def setUpClass(cls, chart_template_ref='ma'):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.company_data['company'].write({
            'vat': 'MA122233411',
            'country_id': cls.env.ref('base.ma').id,
        })

        cls.partner_ma = cls.env['res.partner'].create({
            'name': 'Ma customer',
            'vat': 'MA122233412',
            'country_id': cls.env.ref('base.ma').id,
        })

        cls.product_a = cls.env['product.product'].create({
            'name': 'Product A',
        })

        cls.report = cls.env.ref('l10n_ma.tax_report_vat')
        cls.handler = cls.env['l10n_ma.tax.report.handler']

        cls.options = cls._generate_options(cls.report, '2019-01-01', '2019-02-1')
        # Needed because it will give an error if the period type is not month or quarter
        cls.options['date']['period_type'] = 'month'

    def test_simple_export_tax_report(self):
        """ This will test a simple export with no moves data. """
        generated_export = self.handler.l10n_ma_reports_export_vat_to_xml(self.options)
        generated_export_string = self.get_xml_tree_from_string(generated_export.get('file_content'))
        self.assertXmlTreeEqual(
            generated_export_string,
            self.get_xml_tree_from_string("""
                <DeclarationReleveDeduction>
                    <idf>MA122233411</idf>
                    <annee>2019</annee>
                    <periode>1</periode>
                    <regime>1</regime>
                    <releveDeductions>
                    </releveDeductions>
                </DeclarationReleveDeduction>
            """)
        )

        options = self._generate_options(self.report, '2019-01-01', '2019-04-1')
        # Needed because it will give an error if the period type is not month or quarter
        options['date']['period_type'] = 'quarter'
        generated_export = self.handler.l10n_ma_reports_export_vat_to_xml(options)
        generated_export_string = self.get_xml_tree_from_string(generated_export.get('file_content'))
        self.assertXmlTreeEqual(
            generated_export_string,
            self.get_xml_tree_from_string("""
                <DeclarationReleveDeduction>
                    <idf>MA122233411</idf>
                    <annee>2019</annee>
                    <periode>1</periode>
                    <regime>2</regime>
                    <releveDeductions>
                    </releveDeductions>
                </DeclarationReleveDeduction>
            """)
        )

    def test_export_tax_report_with_data(self):
        """ This will test a simple export with moves data. """
        self.partner_ma.l10n_ma_ice = '20727021'

        self.env['account.move'].create({
            'move_type': 'in_invoice',
            'date': '2019-01-01',
            'invoice_date': '2019-01-01',
            'partner_id': self.partner_ma.id,
            'currency_id': self.currency_data['currency'].id,
            'invoice_line_ids': [Command.create({
                'product_id': self.product_a.id,
                'price_unit': 1000.0,
                'tax_ids': [Command.set(self.company_data['default_tax_purchase'].ids)],
            })],
        }).action_post()

        generated_export = self.handler.l10n_ma_reports_export_vat_to_xml(self.options)
        generated_export_string = self.get_xml_tree_from_string(generated_export.get('file_content'))
        self.assertXmlTreeEqual(
            generated_export_string,
            self.get_xml_tree_from_string("""
                <DeclarationReleveDeduction>
                    <idf>MA122233411</idf>
                    <annee>2019</annee>
                    <periode>1</periode>
                    <regime>1</regime>
                    <releveDeductions>
                        <rd>
                            <ordre>1</ordre>
                            <num>BILL/2019/01/0001</num>
                            <des>BILL/2019/01/0001</des>
                            <mht>500.0</mht>
                            <tva>100.0</tva>
                            <ttc>600.0</ttc>
                            <refF>
                                <if>MA122233412</if>
                                <nom>Ma customer</nom>
                                <ice>20727021</ice>
                            </refF>
                            <tx>20.0</tx>
                            <mp>
                                <id>7</id>
                            </mp>
                            <dpai></dpai>
                            <dfac>2019-01-01</dfac>
                        </rd>
                    </releveDeductions>
                </DeclarationReleveDeduction>
            """)
        )

    def test_export_tax_report_local_partner_with_no_ice(self):
        """
            This test will try to export the xml with a partner missing the ice field. We will check the non critical
            error but also the content of the file to see if the move is well skipped
        """
        partner_ma_with_ice = self.env['res.partner'].create({
            'name': 'Ma customer with ice',
            'vat': 'MA122233411',
            'country_id': self.env.ref('base.ma').id,
            'l10n_ma_ice': '20727021',
        })

        self.env['account.move'].create([
            {
                'move_type': 'in_invoice',
                'date': '2019-01-01',
                'invoice_date': '2019-01-01',
                'partner_id': self.partner_ma.id,
                'currency_id': self.currency_data['currency'].id,
                'invoice_line_ids': [Command.create({
                    'product_id': self.product_a.id,
                    'price_unit': 1000.0,
                    'tax_ids': [Command.set(self.company_data['default_tax_purchase'].ids)],
                })],
            },
            {
                'move_type': 'in_invoice',
                'date': '2019-01-01',
                'invoice_date': '2019-01-01',
                'partner_id': partner_ma_with_ice.id,
                'currency_id': self.currency_data['currency'].id,
                'invoice_line_ids': [Command.create({
                    'product_id': self.product_a.id,
                    'price_unit': 1000.0,
                    'tax_ids': [Command.set(self.company_data['default_tax_purchase'].ids)],
                })],
            },
        ]).action_post()

        template_value = self.handler._l10n_ma_prepare_vat_report_values(self.options)
        self.assertEqual(
            template_value['errors'][0]['message'],
            'There are partners located in morocco without any ICE and/or Tax ID specified. The resulting XML will not contain the associated vendor bills.'
        )

        # This part is needed to avoid the assert of an error and having the content of the file.
        generator_params = {'values': template_value, 'template': 'l10n_ma_reports.l10n_ma_tax_report_template', 'file_type': 'xml'}
        content = self.env['ir.qweb']._render(**generator_params)
        generated_export_string = self.get_xml_tree_from_string(content)
        self.assertXmlTreeEqual(
            generated_export_string,
            self.get_xml_tree_from_string("""
                <DeclarationReleveDeduction>
                    <idf>MA122233411</idf>
                    <annee>2019</annee>
                    <periode>1</periode>
                    <regime>1</regime>
                    <releveDeductions>
                        <rd>
                            <ordre>1</ordre>
                            <num>BILL/2019/01/0002</num>
                            <des>BILL/2019/01/0002</des>
                            <mht>500.0</mht>
                            <tva>100.0</tva>
                            <ttc>600.0</ttc>
                            <refF>
                                <if>MA122233411</if>
                                <nom>Ma customer with ice</nom>
                                <ice>20727021</ice>
                            </refF>
                            <tx>20.0</tx>
                            <mp>
                                <id>7</id>
                            </mp>
                            <dpai></dpai>
                            <dfac>2019-01-01</dfac>
                        </rd>
                    </releveDeductions>
                </DeclarationReleveDeduction>
            """)
        )

    def test_export_tax_report_critical_error(self):
        """
            This test will check the export when having critical error, there is two potentials critical errors.
            - When the company has no vat
            - When the period selected of the report is not monthly or quarterly
        """
        self.env.company.vat = False
        self.partner_ma.l10n_ma_ice = '20727021'

        self.env['account.move'].create({
            'move_type': 'in_invoice',
            'date': '2019-01-01',
            'invoice_date': '2019-01-01',
            'partner_id': self.partner_ma.id,
            'currency_id': self.currency_data['currency'].id,
            'invoice_line_ids': [Command.create({
                'product_id': self.product_a.id,
                'price_unit': 1000.0,
                'tax_ids': [Command.set(self.company_data['default_tax_purchase'].ids)],
            })],
        }).action_post()

        self.assertEqual(
            self.handler._l10n_ma_prepare_vat_report_values(self.options)['errors'][0]['message'],
            f'Company {self.env.company.display_name} has no VAT number and it is required to generate the XML file.'
        )

        self.env.company.vat = 'MA122233411'
        options = self._generate_options(self.report, '2019-01-01', '2019-02-1')
        self.assertEqual(
            self.handler._l10n_ma_prepare_vat_report_values(options)['errors'][0]['message'],
            'This report only supports monthly and quarterly periods.'
        )

    def test_export_tax_report_foreign_customer(self):
        foreign_customer = self.env['res.partner'].create({
            'name': 'Foreign customer with no ice',
            'vat': 'BE0477472701',
            'country_id': self.env.ref('base.be').id,
        })

        self.env['account.move'].create({
            'move_type': 'in_invoice',
            'date': '2019-01-01',
            'invoice_date': '2019-01-01',
            'partner_id': foreign_customer.id,
            'currency_id': self.currency_data['currency'].id,
            'invoice_line_ids': [Command.create({
                'product_id': self.product_a.id,
                'price_unit': 1000.0,
                'tax_ids': [Command.set(self.company_data['default_tax_purchase'].ids)],
            })],
        }).action_post()

        generated_export = self.handler.l10n_ma_reports_export_vat_to_xml(self.options)
        generated_export_string = self.get_xml_tree_from_string(generated_export.get('file_content'))
        self.assertXmlTreeEqual(
            generated_export_string,
            self.get_xml_tree_from_string("""
                <DeclarationReleveDeduction>
                    <idf>MA122233411</idf>
                    <annee>2019</annee>
                    <periode>1</periode>
                    <regime>1</regime>
                    <releveDeductions>
                        <rd>
                            <ordre>1</ordre>
                            <num>BILL/2019/01/0001</num>
                            <des>BILL/2019/01/0001</des>
                            <mht>500.0</mht>
                            <tva>100.0</tva>
                            <ttc>600.0</ttc>
                            <refF>
                                <if>20727020</if>
                                <nom>Foreign customer with no ice</nom>
                                <ice>20727020</ice>
                            </refF>
                            <tx>20.0</tx>
                            <mp>
                                <id>7</id>
                            </mp>
                            <dpai></dpai>
                            <dfac>2019-01-01</dfac>
                        </rd>
                    </releveDeductions>
                </DeclarationReleveDeduction>
            """)
        )
