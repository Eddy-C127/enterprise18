from lxml import etree
import base64
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged
@tagged('post_install', '-at_install')
class TestSepaCommonCreditTransfer(AccountTestInvoicingCommon):
    @classmethod
    def setup_company_data(cls, company_name, chart_template, **kwargs):
        res = super().setup_company_data(company_name, chart_template=chart_template, **kwargs)
        res['company'].update({
            'country_id': cls.env.ref("base.%s" % chart_template[0:2]).id,
            'street': '4 Privet Drive',
            'city': 'Little Whinging',
            'zip': 1997,
            'currency_id': cls.env.ref('base.EUR').id,
            'sepa_orgid_id': '0123456789',
            'sepa_initiating_party_name': 'Grunnings'
        })
        return res

    @classmethod
    def setUpClass(cls, chart_template_ref):
        super().setUpClass(chart_template_ref=chart_template_ref)
        cls.sepa_ct = cls.company_data['default_journal_bank'].outbound_payment_method_line_ids.filtered(lambda l: l.code == 'sepa_ct')
        cls.sepa_ct_method = cls.env.ref('account_sepa.account_payment_method_sepa_ct')

    @classmethod
    def create_payment(cls, bank_journal, partner, amount, ref=None):
        """ Create a SEPA credit transfer payment """
        return cls.env['account.payment'].create({
            'journal_id': bank_journal.id,
            'payment_method_line_id': cls.sepa_ct.id,
            'payment_type': 'outbound',
            'date': '2024-03-04',
            'amount': amount,
            'partner_id': partner.id,
            'partner_type': 'supplier',
            'ref': ref,
        })

    def get_posted_iso20022_batch_payment(self, partner, is_generic_version):
        payment_1 = self.create_payment(self.company_data['default_journal_bank'], partner, 500)
        payment_1.action_post()
        payment_2 = self.create_payment(self.company_data['default_journal_bank'], partner, 600)
        payment_2.action_post()

        batch = self.env['account.batch.payment'].create({
            'journal_id': self.company_data['default_journal_bank'].id,
            'payment_ids': [(4, payment.id, None) for payment in (payment_1 | payment_2)],
            'payment_method_id': self.sepa_ct_method.id,
            'batch_type': 'outbound',
        })
        wizard_action = batch.validate_batch()
        self.assertIsNone(wizard_action)
        batch._send_after_validation()
        self.assertEqual(is_generic_version, batch.sct_generic)
        return batch

    def get_sct_doc_from_batch(self, batch):
        sct_doc = etree.fromstring(base64.b64decode(batch.export_file))
        # Check that all unique elements respect the ISO20022 constraints before replacing them for testing purpose
        namespace = {'ns': 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.03'}
        if batch.company_currency_id.fiscal_country_codes == 'CH':
            namespace = {'ns': 'http://www.six-interbank-clearing.com/de/pain.001.001.03.ch.02.xsd'}
        MsgId = sct_doc.find('.//ns:MsgId', namespaces=namespace)
        self.assertTrue(len(MsgId) <= 35)
        MsgId.text = '12345'
        Date = sct_doc.find('.//ns:CreDtTm', namespaces=namespace)
        # date format : 20yy-mm-ddThh:mm:ss
        date_regex = r'^20\d{2}\-(0[1-9]|1[012])\-(0[1-9]|[12][0-9]|3[01])T([0-1]?\d|2[0-3])(?::([0-5]?\d))?(?::([0-5]?\d))$'
        self.assertRegex(Date.text, date_regex)
        Date.text = '2024-03-04T08:21:16'
        PmtInfId = sct_doc.find('.//ns:PmtInfId', namespaces=namespace)
        self.assertTrue(len(PmtInfId) <= 35)
        PmtInfId.text = '1709540476.798265401'
        InstrId = sct_doc.findall('.//ns:InstrId', namespaces=namespace)
        for instr_id in InstrId:
            self.assertTrue(len(instr_id) <= 35)
            instr_id.text = '5-SCT-BNK1-2024-03-04'
        EndToEndId = sct_doc.findall('.//ns:EndToEndId', namespaces=namespace)
        for end_to_end_id in EndToEndId:
            self.assertTrue(len(end_to_end_id) <= 35)
            end_to_end_id.text = '1709565642.64888074015'
        return sct_doc
