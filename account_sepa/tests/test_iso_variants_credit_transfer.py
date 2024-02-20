from lxml import etree
from odoo.addons.account_sepa.tests.test_sepa_common import TestSepaCommonCreditTransfer
from odoo.tests import tagged
from odoo.tools.misc import file_path
from freezegun import freeze_time


@tagged('post_install', '-at_install')
class TestGermanIsoCreditTransfer(TestSepaCommonCreditTransfer):

    @classmethod
    def setup_company_data(cls, company_name, chart_template='de_skr03', **kwargs):
        res = super().setup_company_data(company_name, chart_template=chart_template, **kwargs)
        cls.german_bank = cls.env['res.bank'].create({
            'name': 'Deutsche Bank',
            'bic': 'DEUTBEBE',
        })
        res['company'].update({'vat': 'DE462612124'})
        res['default_journal_bank'].update({
            'bank_acc_number': 'DE25500105173674149934',
            'bank_id': cls.german_bank.id
        })
        return res

    @classmethod
    def setUpClass(cls, chart_template_ref='de_skr03'):
        super().setUpClass(chart_template_ref=chart_template_ref)
        cls.env.ref('base.EUR').active = True
        cls.german_partner = cls.env['res.partner'].create({
            'name': 'German Customer',
            'street': 'German Street',
            'country_id': cls.env['res.country'].search([('code', '=', 'DE')]).id
        })
        cls.german_partner_bank = cls.env['res.partner.bank'].create({
            'acc_number': 'DE24500105171688544432',
            'allow_out_payment': True,
            'partner_id': cls.german_partner.id,
            'acc_type': 'bank',
            'bank_name': 'Deutsche Bank',
            'bank_id': cls.german_bank.id,
        })

    @freeze_time('2024-03-04')
    def test_german_iso_XML(self):
        batch = self.get_posted_iso20022_batch_payment(self.german_partner, is_generic_version=False)
        sct_doc = self.get_sct_doc_from_batch(batch)
        xml_file_path = file_path('account_sepa/tests/xml_files/pain.001.001.03.de.xml')
        expected_tree = etree.parse(xml_file_path)

        self.assertXmlTreeEqual(sct_doc, expected_tree.getroot())


@tagged('post_install', '-at_install')
class TestAustrianIsoCreditTransfer(TestSepaCommonCreditTransfer):
    @classmethod
    def setup_company_data(cls, company_name, chart_template='at', **kwargs):
        res = super().setup_company_data(company_name, chart_template=chart_template, **kwargs)
        res['company'].update({'vat': 'ATU12345675'})
        cls.austrian_bank = cls.env['res.bank'].create({
            'name': 'UNICREDIT BANK AUSTRIA AG',
            'bic': 'BKAUATWWXXX',
        })
        res['default_journal_bank'].update({
            'bank_acc_number': 'AT61 5400 0825 4928 3818',
            'bank_id': cls.austrian_bank.id
        })
        return res

    @classmethod
    def setUpClass(cls, chart_template_ref='at'):
        super().setUpClass(chart_template_ref=chart_template_ref)
        cls.env.ref('base.EUR').active = True
        cls.austrian_partner = cls.env['res.partner'].create({
            'name': 'Austrian Customer',
            'street': 'Austrian Street',
            'country_id': cls.env['res.country'].search([('code', '=', 'AT')]).id
        })
        cls.austrian_partner_bank = cls.env['res.partner.bank'].create({
            'acc_number': 'AT35 2060 4961 4719 6834',
            'allow_out_payment': True,
            'partner_id': cls.austrian_partner.id,
            'acc_type': 'bank',
            'bank_name': 'UNICREDIT BANK AUSTRIA AG',
            'bank_id': cls.austrian_bank.id,
        })

    @freeze_time('2024-03-04')
    def test_austrian_iso_XML(self):
        batch = self.get_posted_iso20022_batch_payment(self.austrian_partner, is_generic_version=False)
        sct_doc = self.get_sct_doc_from_batch(batch)
        xml_file_path = file_path('account_sepa/tests/xml_files/pain.001.001.03.austrian.004.xml')
        expected_tree = etree.parse(xml_file_path)
        self.assertXmlTreeEqual(sct_doc, expected_tree.getroot())


@tagged('post_install', '-at_install')
class TestSwedishIsoCreditTransfer(TestSepaCommonCreditTransfer):

    @classmethod
    def setup_company_data(cls, company_name, chart_template='se', **kwargs):
        res = super().setup_company_data(company_name, chart_template=chart_template, **kwargs)
        cls.swedish_bank = cls.env['res.bank'].create({
            'name': 'SwedBank',
            'bic': 'SWEDSESSXXX',
        })
        res['company'].update({
            'vat': 'SE123456789701',
            'currency_id': cls.env.ref('base.SEK').id,
            # the Swedish pain version should be able to handle empty address fields
            'street': '',
            'city': '',
            'zip': '',
        })
        res['default_journal_bank'].update({
            'bank_acc_number': 'SE7335536296831513338982',
            'bank_id': cls.swedish_bank.id
        })
        return res

    @classmethod
    def setUpClass(cls, chart_template_ref='se'):
        super().setUpClass(chart_template_ref=chart_template_ref)
        cls.env.ref('base.SEK').active = True
        cls.swedish_partner = cls.env['res.partner'].create({
            'name': 'Swedish Partner',
            'street': 'Swedish Street',
            'country_id': cls.env['res.country'].search([('code', '=', 'SE')]).id
        })
        cls.swedish_partner_bank = cls.env['res.partner.bank'].create({
            'acc_number': 'SE4550000000058398257466',
            'allow_out_payment': True,
            'partner_id': cls.swedish_partner.id,
            'acc_type': 'bank',
            'bank_name': 'Swedbank',
        })

    @freeze_time('2024-03-04')
    def test_swedish_iso_XML(self):
        batch = self.get_posted_iso20022_batch_payment(self.swedish_partner, is_generic_version=True)
        sct_doc = self.get_sct_doc_from_batch(batch)
        xml_file_path = file_path('account_sepa/tests/xml_files/pain.001.001.03.se.xml')
        expected_tree = etree.parse(xml_file_path)

        self.assertXmlTreeEqual(sct_doc, expected_tree.getroot())


@tagged('post_install', '-at_install')
class TestSwissIsoCreditTransfer(TestSepaCommonCreditTransfer):

    @classmethod
    def setup_company_data(cls, company_name, chart_template='ch', **kwargs):
        res = super().setup_company_data(company_name, chart_template=chart_template, **kwargs)
        cls.swiss_bank = cls.env['res.bank'].create({
            'name': 'ONE SWISS BANK SA',
            'bic': 'BQBHCHGG',
        })
        res['company'].update({
            'vat': 'CHE-530781296TVA',
            'currency_id': cls.env.ref('base.CHF').id,
        })
        res['default_journal_bank'].update({
            'bank_acc_number': 'CH4431999123000889012',
            'bank_id': cls.swiss_bank.id
        })
        return res

    @classmethod
    def setUpClass(cls, chart_template_ref='ch'):
        super().setUpClass(chart_template_ref=chart_template_ref)
        cls.env.ref('base.CHF').active = True
        cls.swiss_partner = cls.env['res.partner'].create({
            'name': 'Easy Clean Lausanne',
            'street': 'Rte de Prilly 18, 1004 Lausanne, Suisse',
            'zip': 1004,
            'city': 'Lausanne',
            'country_id': cls.env['res.country'].search([('code', '=', 'CH')]).id
        })
        cls.swiss_partner_bank = cls.env['res.partner.bank'].create({
            'acc_number': 'CH11 3000 5228 1308 3501 F',
            'allow_out_payment': True,
            'partner_id': cls.swiss_partner.id,
            'acc_type': 'bank',
        })

    @freeze_time('2024-03-04')
    def test_swiss_iso_XML(self):
        batch = self.get_posted_iso20022_batch_payment(self.swiss_partner, is_generic_version=True)
        sct_doc = self.get_sct_doc_from_batch(batch)
        xml_file_path = file_path('account_sepa/tests/xml_files/pain.001.001.03.ch.02.xml')
        expected_tree = etree.parse(xml_file_path)
        self.assertXmlTreeEqual(sct_doc, expected_tree.getroot())
