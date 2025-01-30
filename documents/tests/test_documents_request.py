# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64

from odoo.tests.common import Form, RecordCapturer
from odoo.tools import mute_logger
from odoo.addons.mail.tests.common import MailCommon

class TestDocumentRequest(MailCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.doc_partner_1 = cls.env['res.partner'].create({
             'name': 'Test Partner 1',
             'email': 'test1@example.com',
        })
        cls.doc_partner_2 = cls.env['res.partner'].create({
             'name': 'Test Partner 2',
             'email': 'test2@example.com',
        })
        cls.doc_user = cls.env['res.users'].create({
             'name': 'Test Partner',
             'login': 'test_partner',
             'partner_id': cls.doc_partner_1.id,
        })
        cls.folder_a = cls.env['documents.folder'].create({
            'name': 'folder A',
        })
        cls.activity_type = cls.env['mail.activity.type'].create({
            'name': 'request_document',
            'category': 'upload_file',
            'folder_id': cls.folder_a.id,
        })

    def test_request_document_from_partner_with_user(self):
        wizard = self.env['documents.request_wizard'].create({
            'name': 'Wizard Request',
            'requestee_id': self.doc_partner_1.id,
            'activity_type_id': self.activity_type.id,
            'folder_id': self.folder_a.id,
        })
        with self.mock_mail_gateway():
            document = wizard.request_document()

        self.assertEqual(document.create_share_id.owner_id.id, wizard.requestee_id.id, "Owner of the share is requestee")
        self.assertEqual(document.request_activity_id.user_id, self.doc_user, "Activity assigned to the requestee")
        self.assertEqual(document.owner_id, self.env.user, "Owner of the document is the requester")
        self.assertSentEmail('"OdooBot" <odoobot@example.com>', self.doc_partner_1, subject='Document Request : Wizard Request')

    def test_request_document_from_partner_without_user(self):
        wizard = self.env['documents.request_wizard'].create({
            'name': 'Wizard Request 2',
            'requestee_id': self.doc_partner_2.id,
            'activity_type_id': self.activity_type.id,
            'folder_id': self.folder_a.id,
        })
        with self.mock_mail_gateway():
            document = wizard.request_document()

        self.assertEqual(document.request_activity_id.user_id, self.env.user, "Activity assigned to the requester because the requestee has no user")
        self.assertEqual(document.owner_id, self.env.user, "Owner of the document is the requester")
        self.assertSentEmail('"OdooBot" <odoobot@example.com>', self.doc_partner_2, subject='Document Request : Wizard Request 2')

    @mute_logger('odoo.addons.mail.models.mail_mail')
    def test_send_message_with_attachment_on_doc_request(self):
        wizard = self.env['documents.request_wizard'].create({
            'name': 'Wizard Request 3',
            'requestee_id': self.doc_partner_2.id,
            'activity_type_id': self.activity_type.id,
            'folder_id': self.folder_a.id,
        })
        with self.mock_mail_gateway():
            document = wizard.request_document()

        form = Form(self.env['mail.compose.message'].with_context({
            'default_partner_ids': self.doc_partner_1.ids,
            'default_model': document._name,
            'default_res_ids': document.ids,
        }))
        form.body = '<p>Hello</p>'
        form.subject = 'Example of document required'
        # Simulate file upload on the composed message
        form.attachment_ids = self.env['ir.attachment'].create({
            'datas': base64.b64encode(b'My attachment'),
            'name': 'doc.txt',
            'res_model': 'mail.compose.message',
            'res_id': form._record.id,
        })
        saved_form = form.save()
        with self.mock_mail_gateway(), RecordCapturer(self.env['mail.message'], []) as capture:
            saved_form._action_send_mail()
            message = capture.records

        self.assertEqual(len(message), 1)
        self.assertFalse(document.attachment_id)
        self.assertEqual(document.type, 'empty')
        self.assertEqual(message.body, '<p>Hello</p>')
        self.assertEqual(message.partner_ids, self.doc_partner_1)
        self.assertEqual(message.subject, 'Example of document required')
