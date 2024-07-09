# -*- coding: utf-8 -*-

import base64

from odoo.tests import Form

from odoo.exceptions import UserError
from odoo.tests.common import tagged
from odoo.addons.account.tests.common import AccountTestInvoicingCommon

GIF = b"R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs="
TEXT = base64.b64encode(bytes("workflow bridge account", 'utf-8'))


@tagged('post_install', '-at_install', 'test_document_bridge')
class TestCaseDocumentsBridgeAccount(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.folder_a = cls.env['documents.folder'].create({
            'name': 'folder A',
        })
        cls.folder_a_a = cls.env['documents.folder'].create({
            'name': 'folder A - A',
            'parent_folder_id': cls.folder_a.id,
        })
        cls.document_txt = cls.env['documents.document'].create({
            'datas': TEXT,
            'name': 'file.txt',
            'mimetype': 'text/plain',
            'folder_id': cls.folder_a_a.id,
        })
        cls.document_gif = cls.env['documents.document'].create({
            'datas': GIF,
            'name': 'file.gif',
            'mimetype': 'image/gif',
            'folder_id': cls.folder_a.id,
        })

        cls.workflow_rule_vendor_bill = cls.env['documents.workflow.rule'].create({
            'domain_folder_id': cls.folder_a.id,
            'name': 'workflow rule create vendor bill on f_a',
            'create_model': 'account.move.in_invoice',
        })

    def test_action_view_documents_account_move(self):
        """
        Test the behavior of opening default folder when there are more than one documents.
        """
        self.env.user.company_id.documents_account_settings = True
        account_move_test_1, account_move_test_2 = self.env['account.move'].create([{
            'name': 'Journal Entry 1',
            'move_type': 'entry',
        }, {
            'name': 'Journal Entry 2',
            'move_type': 'entry',
        }])
        self.env['documents.account.folder.setting'].create({
            'folder_id': self.folder_a.id,
            'journal_id': account_move_test_1.journal_id.id,
        })
        self.assertFalse(account_move_test_1.has_documents, "Should be False because no attachment is attached to this record")
        self.assertFalse(account_move_test_2.has_documents, "Should be False because no attachment is attached to this record")
        attachments = self.env['ir.attachment'].create([{
            'name': 'fileText_test.txt',
            'res_model': 'account.move',
            'res_id': account_move_test_1.id,
        }, {
            'name': 'fileText_test2.txt',
            'res_model': 'account.move',
            'res_id': account_move_test_1.id,
        }])
        self.assertTrue(account_move_test_1.has_documents, "Should be True because attachment is attached to this record")
        self.assertFalse(account_move_test_2.has_documents, "Should be False because no attachment is attached to this record")

        # If both the documents have same folder, open that folder.
        action = account_move_test_1.action_view_documents_account_move()
        self.assertEqual(action['context']['searchpanel_default_folder_id'], self.folder_a.id, "The 'folder A' should be the default.")

        # If both the documents have different folder, open the 'All' folder.
        folder_test = self.env['documents.folder'].create({'name': 'folder_test'})
        document = self.env['documents.document'].search([('attachment_id', '=', attachments[0].id)])
        document.folder_id = folder_test.id

        action = account_move_test_1.action_view_documents_account_move()
        self.assertFalse(action['context']['searchpanel_default_folder_id'], "The 'All' folder should be the default.")

    def test_bridge_folder_workflow(self):
        """
        tests the create new business model (vendor bill & credit note).

        """
        self.assertEqual(self.document_txt.res_model, 'documents.document', "failed at default res model")
        multi_return = self.workflow_rule_vendor_bill.apply_actions([self.document_txt.id, self.document_gif.id])
        self.assertEqual(multi_return.get('type'), 'ir.actions.act_window',
                         'failed at invoice workflow return value type')
        self.assertEqual(multi_return.get('res_model'), 'account.move',
                         'failed at invoice workflow return value res model')

        self.assertEqual(self.document_txt.res_model, 'account.move', "failed at workflow_bridge_dms_account"
                                                                           " new res_model")
        vendor_bill_txt = self.env['account.move'].search([('id', '=', self.document_txt.res_id)])
        self.assertTrue(vendor_bill_txt.exists(), 'failed at workflow_bridge_dms_account vendor_bill')
        self.assertEqual(self.document_txt.res_id, vendor_bill_txt.id, "failed at workflow_bridge_dms_account res_id")
        self.assertEqual(vendor_bill_txt.move_type, 'in_invoice', "failed at workflow_bridge_dms_account vendor_bill type")
        vendor_bill_gif = self.env['account.move'].search([('id', '=', self.document_gif.res_id)])
        self.assertEqual(self.document_gif.res_id, vendor_bill_gif.id, "failed at workflow_bridge_dms_account res_id")

        single_return = self.workflow_rule_vendor_bill.apply_actions([self.document_txt.id])
        self.assertEqual(single_return.get('res_model'), 'account.move',
                         'failed at invoice res_model action from workflow create model')
        invoice = self.env[single_return['res_model']].browse(single_return.get('res_id'))
        attachments = self.env['ir.attachment'].search([('res_model', '=', 'account.move'), ('res_id', '=', invoice.id)])
        self.assertEqual(len(attachments), 1, 'there should only be one ir attachment matching')

    def test_bridge_account_account_settings_on_write(self):
        """
        Makes sure the settings apply their values when an ir_attachment is set as message_main_attachment_id
        on invoices.
        """
        folder_test = self.env['documents.folder'].create({'name': 'folder_test'})
        self.env.user.company_id.documents_account_settings = True

        for invoice_type in ['in_invoice', 'out_invoice', 'in_refund', 'out_refund']:
            invoice_test = self.env['account.move'].with_context(default_move_type=invoice_type).create({
                'name': 'invoice_test',
                'move_type': invoice_type,
            })
            setting = self.env['documents.account.folder.setting'].create({
                'folder_id': folder_test.id,
                'journal_id': invoice_test.journal_id.id,
            })

            attachments = self.env["ir.attachment"]
            for i in range(3):
                attachment = self.env["ir.attachment"].create({
                    "datas": TEXT,
                    "name": f"fileText_test{i}.txt",
                    "mimetype": "text/plain",
                    "res_model": "account.move",
                    "res_id": invoice_test.id,
                })
                attachment.register_as_main_attachment(force=False)
                attachments |= attachment

            document = self.env["documents.document"].search(
                [("attachment_id", "=", attachments[0].id)]
            )
            self.assertEqual(
                document.folder_id, folder_test, "the text test document have a folder"
            )

            def check_main_attachment_and_document(
                main_attachment, doc_attachment, previous_attachment_ids
            ):
                self.assertRecordValues(
                    invoice_test,
                    [{"message_main_attachment_id": main_attachment.id}],
                )
                self.assertRecordValues(
                    document,
                    [
                        {
                            "attachment_id": doc_attachment.id,
                            "previous_attachment_ids": previous_attachment_ids,
                        }
                    ],
                )

            # Ensure the main attachment is the first one and ensure the document is correctly linked
            check_main_attachment_and_document(attachments[0], attachments[0], [])

            # Switch the main attachment to the second one and ensure the document is updated correctly
            invoice_test.write({"message_main_attachment_id": attachments[1].id})
            check_main_attachment_and_document(
                attachments[1], attachments[1], attachments[0].ids
            )

            # Switch the main attachment to the third one and ensure the document is updated correctly
            attachments[2].register_as_main_attachment(force=True)
            check_main_attachment_and_document(
                attachments[2], attachments[2], (attachments[0] + attachments[1]).ids
            )

            # Ensure all attachments are still linked to the invoice
            attachments = self.env["ir.attachment"].search(
                [("res_model", "=", "account.move"), ("res_id", "=", invoice_test.id)]
            )
            self.assertEqual(
                len(attachments),
                3,
                "there should be 3 attachments linked to the invoice",
            )

            # deleting the setting to prevent duplicate settings.
            setting.unlink()

    def test_bridge_account_account_settings_on_write_with_versioning(self):
        """
        With accounting-document centralization activated, make sure that the right attachment
        is set as main attachment on the invoice when versioning is involved and only one document
        is being created and updated.
        """
        folder_test = self.env["documents.folder"].create({"name": "folder_test"})
        self.env.user.company_id.documents_account_settings = True

        invoice_test = (
            self.env["account.move"]
            .with_context(default_move_type="in_invoice")
            .create({
                "name": "invoice_test",
                "move_type": "in_invoice",
            })
        )

        self.env["documents.account.folder.setting"].create({
            "folder_id": folder_test.id,
            "journal_id": invoice_test.journal_id.id,
        })

        attachments = self.env["ir.attachment"]
        for i in range(1, 3):
            attachment = self.env["ir.attachment"].create({
                "datas": TEXT,
                "name": f"attachment-{i}.txt",
                "mimetype": "text/plain",
                "res_model": "account.move",
                "res_id": invoice_test.id,
            })
            attachment.register_as_main_attachment(force=False)
            attachments |= attachment

        first_attachment, second_attachment = attachments[0], attachments[1]

        document = self.env["documents.document"].search(
            [("res_model", "=", "account.move"), ("res_id", "=", invoice_test.id)]
        )
        self.assertEqual(
            len(document), 1, "there should be 1 document linked to the invoice"
        )
        self.assertEqual(
            document.folder_id, folder_test, "the text test document have a folder"
        )

        def check_main_attachment_and_document(
            main_attachment, doc_attachment, previous_attachment_ids
        ):
            self.assertRecordValues(
                invoice_test,
                [{"message_main_attachment_id": main_attachment.id}],
            )
            self.assertRecordValues(
                document,
                [
                    {
                        "attachment_id": doc_attachment.id,
                        "previous_attachment_ids": previous_attachment_ids,
                    }
                ],
            )

        # Ensure the main attachment is attachment-1
        check_main_attachment_and_document(first_attachment, first_attachment, [])

        # Version the main attachment:
        # attachment-1 become attachment-3
        # version attachement become attachment-1
        document.write({
            "datas": TEXT,
            "name": "attachment-3.txt",
            "mimetype": "text/plain",
        })
        third_attachment = document.attachment_id
        first_attachment = document.previous_attachment_ids[0]
        check_main_attachment_and_document(
            third_attachment, third_attachment, first_attachment.ids
        )

        # Switch main attachment to attachment-2
        second_attachment.register_as_main_attachment(force=True)
        check_main_attachment_and_document(
            second_attachment,
            second_attachment,
            (first_attachment + third_attachment).ids,
        )

        # restore versioned attachment (attachment-1)
        document.write({"attachment_id": document.previous_attachment_ids[0].id})
        check_main_attachment_and_document(
            second_attachment,
            first_attachment,
            (third_attachment + second_attachment).ids,
        )

        # Switch main attachment to attachment-3
        third_attachment.register_as_main_attachment(force=True)
        check_main_attachment_and_document(
            third_attachment,
            third_attachment,
            (second_attachment + first_attachment).ids,
        )

        # Ensure there is still only one document linked to the invoice
        document = self.env["documents.document"].search(
            [("res_model", "=", "account.move"), ("res_id", "=", invoice_test.id)]
        )
        self.assertEqual(
            len(document), 1, "there should be 1 document linked to the invoice"
        )

    def test_journal_entry(self):
        """
        Makes sure the settings apply their values when an ir_attachment is set as message_main_attachment_id
        on invoices.
        """
        folder_test = self.env['documents.folder'].create({'name': 'Bills'})
        self.env.user.company_id.documents_account_settings = True

        invoice_test = self.env['account.move'].with_context(default_move_type='entry').create({
            'name': 'Journal Entry',
            'move_type': 'entry',
        })
        setting = self.env['documents.account.folder.setting'].create({
            'folder_id': folder_test.id,
            'journal_id': invoice_test.journal_id.id,
        })
        attachments = self.env['ir.attachment'].create([{
            'datas': TEXT,
            'name': 'fileText_test.txt',
            'mimetype': 'text/plain',
            'res_model': 'account.move',
            'res_id': invoice_test.id
        }, {
            'datas': TEXT,
            'name': 'fileText_test2.txt',
            'mimetype': 'text/plain',
            'res_model': 'account.move',
            'res_id': invoice_test.id
        }])
        documents = self.env['documents.document'].search([('attachment_id', 'in', attachments.ids)])
        self.assertEqual(len(documents), 2)
        setting.unlink()

    def test_bridge_account_workflow_settings_on_write(self):
        """
        Tests that tags added by a workflow action are not completely overridden by the settings.
        """
        self.env.user.company_id.documents_account_settings = True
        tag_category_a = self.env['documents.facet'].create({
            'folder_id': self.folder_a.id,
            'name': "categ_a",
        })
        tag_a = self.env['documents.tag'].create({
            'facet_id': tag_category_a.id,
            'name': "tag_a",
        })
        tag_b = self.env['documents.tag'].create({
            'facet_id': tag_category_a.id,
            'name': "tag_b",
        })
        tag_action_a = self.env['documents.workflow.action'].create({
            'action': 'add',
            'facet_id': tag_category_a.id,
            'tag_id': tag_a.id,
        })
        self.workflow_rule_vendor_bill.tag_action_ids += tag_action_a

        invoice_test = self.env['account.move'].with_context(default_move_type='in_invoice').create({
            'name': 'invoice_test',
            'move_type': 'in_invoice',
        })
        self.env['documents.account.folder.setting'].create({
            'folder_id': self.folder_a.id,
            'journal_id': invoice_test.journal_id.id,
            'tag_ids': tag_b,
        })
        document_test = self.env['documents.document'].create({
            'name': 'test reconciliation workflow',
            'folder_id': self.folder_a.id,
            'datas': TEXT,
        })
        self.workflow_rule_vendor_bill.apply_actions([document_test.id])
        self.assertEqual(document_test.tag_ids, tag_a | tag_b,
            "The document should have the workflow action's tag(s)")

    def test_bridge_account_sync_partner(self):
        """
        Tests that the partner is always synced on the document, regardless of settings
        """
        partner_1, partner_2 = self.env['res.partner'].create([{'name': 'partner_1'}, {'name': 'partner_2'}])
        self.document_txt.partner_id = partner_1
        self.workflow_rule_vendor_bill.apply_actions([self.document_txt.id, self.document_gif.id])
        move = self.env['account.move'].browse(self.document_txt.res_id)
        self.assertEqual(move.partner_id, partner_1)
        move.partner_id = partner_2
        self.assertEqual(self.document_txt.partner_id, partner_2)

    def test_embedded_pdf(self):
        document = self.env['documents.document'].create({
            'name': 'test',
            'folder_id': self.folder_a.id,
            'datas': base64.b64encode(b'<test> </test>'),
        })
        self.assertEqual(document.mimetype, 'application/xml')
        self.assertFalse(document._extract_pdf_from_xml())
        self.assertFalse(document.thumbnail_status)
        self.assertFalse(document.has_embedded_pdf)

        document = self.env['documents.document'].create({
            'name': 'test',
            'folder_id': self.folder_a.id,
            'datas': base64.b64encode(b'<test> <Attachment>JVBERi0gRmFrZSBQREYgY29udGVudA==</Attachment> </test>'),
        })
        self.assertEqual(document.mimetype, 'application/xml')
        self.assertEqual(document._extract_pdf_from_xml(), b'%PDF- Fake PDF content')
        self.assertEqual(document.thumbnail_status, 'client_generated')
        self.assertTrue(document.has_embedded_pdf)

    def test_move_document_unlink(self):
        """Test that the document is sent to trash when the `account.move` is unlinked."""
        document1, document2 = self.document_txt, self.document_gif
        self.workflow_rule_vendor_bill.apply_actions([document1.id, document2.id])
        self.assertEqual(document1.res_model, "account.move")
        self.assertEqual(document2.res_model, "account.move")
        move1 = self.env["account.move"].browse(document1.res_id).exists()
        move2 = self.env["account.move"].browse(document2.res_id).exists()
        self.assertTrue(move1)
        self.assertTrue(move2)
        attachment1 = self.env['ir.attachment'].search([
            ('res_model', '=', move1._name),
            ('res_id', '=', move1.id),
        ])
        attachment2 = self.env['ir.attachment'].search([
            ('res_model', '=', move2._name),
            ('res_id', '=', move2.id),
        ])
        # attachment not linked to a document
        attachment3 = self.env['ir.attachment'].create({
            'name': 'Attachment 3',
            'res_model': move2._name,
            'res_id': move2.id,
        })
        self.assertEqual(len(attachment1), 1)
        self.assertEqual(len(attachment2), 1)

        self.env.flush_all()
        with self.assertQueryCount(62):
            # Local: 48, runbot: 62
            (move1 | move2).unlink()

        self.assertTrue(attachment1.exists())
        self.assertTrue(document1.exists())
        self.assertFalse(document1.active)

        self.assertTrue(attachment2.exists())
        self.assertTrue(document2.exists())
        self.assertFalse(document2.active)

        self.assertFalse(attachment3.exists(),
            "That attachment is not linked to a record and so it should be removed")

        # removing the document in the trash clean the attachment
        document2.unlink()
        self.assertFalse(attachment2.exists())

    def test_workflow_create_misc_entry(self):
        misc_entry_rule = self.env.ref('documents_account.misc_entry_rule')
        misc_entry_rule.journal_id = misc_entry_rule.suitable_journal_ids[0]
        misc_entry_action = misc_entry_rule.apply_actions([self.document_txt.id, self.document_gif.id])
        move = self.env['account.move'].browse(self.document_txt.res_id)
        self.assertEqual(misc_entry_action.get('res_model'), 'account.move')
        self.assertEqual(move.move_type, 'entry')
        self.assertTrue(move.journal_id in misc_entry_rule.suitable_journal_ids)

    def test_workflow_create_bank_statement_raise(self):
        with self.assertRaises(UserError): # Could not make sense of the given file.
            self.env.ref('documents_account.bank_statement_rule').apply_actions([self.document_txt.id, self.document_gif.id])

    def test_workflow_create_vendor_bill(self):
        vendor_bill_entry_rule = self.env.ref('documents_account.vendor_bill_rule_financial')
        vendor_bill_entry_action = vendor_bill_entry_rule.apply_actions([self.document_txt.id])
        move = self.env['account.move'].browse(self.document_txt.res_id)
        self.assertEqual(vendor_bill_entry_action.get('res_model'), 'account.move')
        self.assertEqual(move.move_type, 'in_invoice')
        self.assertTrue(move.journal_id in vendor_bill_entry_rule.suitable_journal_ids)

    def test_workflow_create_vendor_receipt(self):
        # Activate the group for the vendor receipt
        self.env['res.config.settings'].create({'group_show_purchase_receipts': True}).execute()
        self.assertTrue(self.env.user.has_group('account.group_purchase_receipts'), 'The "purchase Receipt" feature should be enabled.')
        vendor_receipt_rule = self.env.ref('documents_account.documents_vendor_receipt_rule')
        vendor_receipt_action = vendor_receipt_rule.apply_actions([self.document_txt.id])
        move = self.env['account.move'].browse(self.document_txt.res_id)
        self.assertEqual(vendor_receipt_action.get('res_model'), 'account.move')
        self.assertEqual(move.move_type, 'in_receipt')
        self.assertTrue(move.journal_id in vendor_receipt_rule.suitable_journal_ids)

    def test_workflow_rule_form_journal(self):
        rule_financial = self.env.ref('documents_account.vendor_bill_rule_financial')
        rule_financial.journal_id = rule_financial.suitable_journal_ids[0]
        with Form(rule_financial) as rule:
            # our accounting action has a journal_id
            self.assertTrue(rule.journal_id)

            # switching it to non-accouting action resets its journal_id on write/create
            rule.create_model = 'link.to.record'
            rule.save()
            self.assertFalse(rule.journal_id)

            # switching back gives us the rigth journal_id on write/create
            rule.create_model = 'account.move.out_invoice'
            rule.save()
            self.assertTrue(rule.journal_id.type == 'sale')
            self.assertTrue(rule.journal_id in rule.suitable_journal_ids)
