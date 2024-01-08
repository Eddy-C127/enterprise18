# -*- coding: utf-8 -*-
from datetime import date, timedelta
from unittest.mock import patch

from freezegun import freeze_time

from odoo.addons.account_reports.tests.common import TestAccountReportsCommon
from odoo.tests import tagged


@tagged('post_install_l10n', 'post_install', '-at_install')
@freeze_time("2019-12-31")
class TestL10nBeReportsPostWizard(TestAccountReportsCommon):

    @classmethod
    @TestAccountReportsCommon.setup_country('be')
    def setUpClass(cls):
        super().setUpClass()
        cls.company.update({
            'vat': 'BE0477472701',
        })
        cls.company.partner_id.update({
            'email': 'jsmith@mail.com',
            'phone': '+32475123456',
        })

    def setUp(self, *args, **kwargs):
        super().setUp(*args, **kwargs)

        self.tax_return_move = self.env['account.move'].search([
            ('tax_closing_end_date', '!=', False),
            ('state', '=', 'draft'),
            ('company_id', '=', self.company_data['company'].id),
        ])

        # Force the closing end date in the past to avoid an error
        today = date.today()
        end_of_last_month = today + timedelta(days=-today.day)
        self.tax_return_move.write({
            'date': end_of_last_month,
            'tax_closing_end_date': end_of_last_month,
        })

    def test_posting_opens_wizard(self):
        ''' Test that posting the tax report opens the wizard
        '''
        self.tax_return_move.refresh_tax_entry()

        # Posting the tax returns move of a Belgian company opens a wizard
        action = self.tax_return_move.action_post()

        self.assertRecordValues(self.tax_return_move, [{'state': 'draft'}])
        self.assertGreaterEqual(action.items(), {
            'name': 'Post a tax report entry',
            'view_mode': 'form',
            'views': [[self.env.ref('l10n_be_reports_post_wizard.view_account_financial_report_export').id, 'form']],
            'res_model': 'l10n_be_reports.periodic.vat.xml.export',
            'type': 'ir.actions.act_window',
            'target': 'new',
        }.items())
        self.assertGreaterEqual(action['context'].items(), {
            'l10n_be_reports_generation_options': {},
            'l10n_be_action_resume_post_move_ids': self.tax_return_move.ids,
        }.items())

    def test_validating_wizard_posts_move(self):
        ''' Test that validating the wizard posts the move
        '''
        self.tax_return_move.refresh_tax_entry()

        # Posting the tax returns move with the wizard data actually posts the move
        report = self.env.ref('l10n_be.tax_report_vat')
        options = self._generate_options(report, '2023-01-31', '2023-01-31')

        mock_pdf = {
            'file_name': report.get_default_report_filename(options, 'pdf'),
            'file_content': b'',
            'file_type': 'pdf',
        }

        with patch.object(type(report), 'export_to_pdf', autospec=True, side_effect=lambda *args, **kwargs: mock_pdf):
            self.tax_return_move.with_context({'l10n_be_reports_generation_options': options}).action_post()

        self.assertRecordValues(self.tax_return_move, [{'state': 'posted'}])
        attachment_ids = self.env['ir.attachment'].search([
            ('res_model', '=', 'account.move'),
            ('res_id', '=', self.tax_return_move.id),
            ('name', '=', 'vat_return.xml'),
        ])
        self.assertEqual(len(attachment_ids), 1)

    def test_wizard_comment_xml(self):
        """Ensure that the tax report comment is set in the generated XML."""
        self.tax_return_move.refresh_tax_entry()
        action = self.tax_return_move.action_post()

        test_comment = "test comment"
        ref = str(self.env.company.partner_id.id) + '112019'

        export_wizard = self.env[action['res_model']].with_context(action['context']).create({'comment': test_comment})

        report = self.env.ref('l10n_be.tax_report_vat')
        options = self._generate_options(report, '2023-01-31', '2023-01-31')

        mock_pdf = {
            'file_name': report.get_default_report_filename(options, 'pdf'),
            'file_content': b'',
            'file_type': 'pdf',
        }
        with patch.object(type(self.env['account.report']), 'export_to_pdf', autospec=True, side_effect=lambda *args, **kwargs: mock_pdf):
            export_wizard.action_resume_post()

        expected_xml = f"""
        <ns2:VATConsignment xmlns="http://www.minfin.fgov.be/InputCommon" xmlns:ns2="http://www.minfin.fgov.be/VATConsignment" VATDeclarationsNbr="1">
            <ns2:VATDeclaration SequenceNumber="1" DeclarantReference="{ref}">
                <ns2:Declarant>
                    <VATNumber xmlns="http://www.minfin.fgov.be/InputCommon">0477472701</VATNumber>
                    <Name>company_1_data</Name>
                    <Street></Street>
                    <PostCode></PostCode>
                    <City></City>
                    <CountryCode>BE</CountryCode>
                    <EmailAddress>jsmith@mail.com</EmailAddress>
                    <Phone>+32475123456</Phone>
                </ns2:Declarant>
                <ns2:Period>
                    <ns2:Month>11</ns2:Month>
                    <ns2:Year>2019</ns2:Year>
                </ns2:Period>
                <ns2:Data>
                    <ns2:Amount GridNumber="71">0.00</ns2:Amount>
                </ns2:Data>
                <ns2:ClientListingNihil>NO</ns2:ClientListingNihil>
                <ns2:Ask Restitution="NO" Payment="NO"/>
                <ns2:Comment>{test_comment}</ns2:Comment>
            </ns2:VATDeclaration>
        </ns2:VATConsignment>
        """

        attachment_ids = self.env['ir.attachment'].search([
            ('res_model', '=', 'account.move'),
            ('res_id', '=', self.tax_return_move.id),
            ('name', '=', 'vat_return.xml'),
        ])

        self.assertXmlTreeEqual(
            self.get_xml_tree_from_string(attachment_ids.raw),
            self.get_xml_tree_from_string(expected_xml),
        )
