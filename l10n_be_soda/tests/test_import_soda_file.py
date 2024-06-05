# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged
from odoo.tools import file_open


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestSodaFile(AccountTestInvoicingCommon):

    @classmethod
    @AccountTestInvoicingCommon.setup_country('be')
    def setUpClass(cls):
        super().setUpClass()
        cls.env.company.vat = 'BE0477472701'
        cls.misc_journal = cls.env['account.journal'].create({
            'name': 'Miscellaneous',
            'code': 'smis',
            'type': 'general',
        })
        cls.soda_file_path = 'l10n_be_soda/test_soda_file/soda_testing_file.xml'
        cls.soda_file_path_with_new = 'l10n_be_soda/test_soda_file/soda_testing_file_with_new_account.xml'
        cls.attachment = False

    def test_soda_file_import(self):
        with file_open(self.soda_file_path, 'rb') as soda_file:
            wizard_action = self.misc_journal.create_document_from_attachment(self.env['ir.attachment'].create({
                'mimetype': 'application/xml',
                'name': 'soda_testing_file.xml',
                'raw': soda_file.read(),
            }).ids)
            self.assertEqual(wizard_action['res_model'], 'soda.import.wizard')
            wizard = self.env['soda.import.wizard'].search([('id', '=', wizard_action['res_id'])])
            result = wizard.action_save_and_import()
            result_move = self.env['account.move'].search([('id', '=', result['res_id'])])
            self.assertEqual(len(result_move.line_ids), 3)
            self.assertRecordValues(result_move.line_ids, [
                {'debit': 0, 'credit': 4000.00, 'name': 'Withholding Taxes'},
                {'debit': 0, 'credit': 11655.10, 'name': 'Special remuneration'},
                {'debit': 15655.10, 'credit': 0, 'name': 'Remuneration'},
            ])
            self.assertRecordValues(result_move.line_ids.account_id, [{'code': '453000'}, {'code': '455000'}, {'code': '618000'}])
            self.assertEqual(result_move.date.strftime("%Y-%m-%d"), '2021-10-23')

    def test_soda_file_import_map_accounts(self):
        with file_open(self.soda_file_path, 'rb') as soda_file:
            wizard_action = self.misc_journal.create_document_from_attachment(self.env['ir.attachment'].create({
                'mimetype': 'application/xml',
                'name': 'soda_testing_file.xml',
                'raw': soda_file.read(),
            }).ids)
            self.assertEqual(wizard_action['res_model'], 'soda.import.wizard')
            wizard = self.env['soda.import.wizard'].search([('id', '=', wizard_action['res_id'])])
            account_mapping = {
                '4530': self.env['account.chart.template'].ref('a100'),
                '4550': self.env['account.chart.template'].ref('a7000'),
                '618000': False,
            }
            for mapping in wizard.soda_account_mapping_ids:
                mapping.account_id = account_mapping[mapping.code]

            account_618000 = self.env['account.chart.template'].ref('a618')
            mapping_618000 = wizard.soda_account_mapping_ids.search([('code', '=', '618000'), ('company_id', '=', wizard.company_id.id)])
            mapping_618000.account_id = account_618000

            result = wizard.action_save_and_import()
            result_move = self.env['account.move'].search([('id', '=', result['res_id'])])
            self.assertEqual(len(result_move.line_ids), 3)
            self.assertRecordValues(result_move.line_ids, [
                {'debit': 0, 'credit': 4000.00, 'name': 'Withholding Taxes'},
                {'debit': 0, 'credit': 11655.10, 'name': 'Special remuneration'},
                {'debit': 15655.10, 'credit': 0, 'name': 'Remuneration'},
            ])
            self.assertRecordValues(result_move.line_ids.account_id, [{'code': '100000'}, {'code': '700000'}, {'code': '618000'}])

    def test_soda_file_import_auto_mapping(self):
        """
        If a mapping is not found for an imported Soda account, we should put it in the Suspense Account.
        When the user manually updates the generated entry and modifies the Suspense Account to
        an account of its choice, the global mapping should be updated too for future imports.
        However, if the global mapping is updated, existing entries shouldn't.
        """
        with file_open(self.soda_file_path_with_new, 'rb') as soda_file:
            wizard_action = self.misc_journal.create_document_from_attachment(self.env['ir.attachment'].create({
                'mimetype': 'application/xml',
                'name': 'soda_testing_file_with_new_account.xml',
                'raw': soda_file.read(),
            }).ids)
            company = self.misc_journal.company_id
            self.assertEqual(wizard_action['res_model'], 'soda.import.wizard')
            wizard = self.env['soda.import.wizard'].browse(wizard_action['res_id'])
            result = wizard.action_save_and_import()
            move = self.env['account.move'].browse(result['res_id'])

            suspense_account = company.account_journal_suspense_account_id
            account_455 = self.env["account.chart.template"].ref('a455')
            account_440 = self.env["account.chart.template"].ref('a440')

            # Suspense account should be used for unmapped account 12345 (see test file)
            self.assertRecordValues(move.line_ids, [
                {'debit': 0, 'credit': 4000, 'name': '', 'account_id': suspense_account.id},
                {'debit': 0, 'credit': 11655.1, 'name': 'Special remuneration', 'account_id': account_455.id},
                {'debit': 15655.1, 'credit': 0, 'name': 'Remuneration', 'account_id': account_440.id},
            ])

            # Global Soda mapping should be updated
            self.assertRecordValues(wizard.soda_account_mapping_ids, [
                {"code": "12345", "account_id": False},
                {"code": "4550", "account_id": account_455.id},
                {"code": "440000", "account_id": account_440.id},
            ])

            # Now we manually update the entry to replace the temporary Suspense Account to another account
            account_454 = self.env["account.chart.template"].ref('a454')
            move.line_ids[0].account_id = account_454
            self.assertRecordValues(move.line_ids, [
                {'debit': 0, 'credit': 4000, 'name': '', 'account_id': account_454.id},
                {'debit': 0, 'credit': 11655.1, 'name': 'Special remuneration', 'account_id': account_455.id},
                {'debit': 15655.1, 'credit': 0, 'name': 'Remuneration', 'account_id': account_440.id},
            ])

            # Global Soda mapping should now be updated too
            self.assertRecordValues(wizard.soda_account_mapping_ids, [
                {"code": "12345", "account_id": account_454.id},
                {"code": "4550", "account_id": account_455.id},
                {"code": "440000", "account_id": account_440.id},
            ])

            # However, updating the mapping shouldn't affect already created entries
            wizard.soda_account_mapping_ids[-1].account_id = account_455
            self.assertEqual(move.line_ids[0].account_id, account_454)
