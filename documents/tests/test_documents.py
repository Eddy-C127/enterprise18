# -*- coding: utf-8 -*-
from odoo.tests.common import TransactionCase
import base64

GIF = b"R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs="
TEXT = base64.b64encode(bytes("TEST", 'utf-8'))
DATA = "data:application/zip;base64,R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs="
file_a = {'name': 'doc.zip', 'data': 'data:application/zip;base64,R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs='}
file_b = {'name': 'icon.zip', 'data': 'data:application/zip;base64,R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs='}


class TestCaseDocuments(TransactionCase):
    """ """
    def setUp(self):
        super(TestCaseDocuments, self).setUp()
        self.folder_a = self.env['documents.folder'].create({
            'name': 'folder A',
        })
        self.folder_a_a = self.env['documents.folder'].create({
            'name': 'folder A - A',
            'parent_folder_id': self.folder_a.id,
        })
        self.folder_b = self.env['documents.folder'].create({
            'name': 'folder B',
        })
        self.tag_category_b = self.env['documents.facet'].create({
            'folder_id': self.folder_b.id,
            'name': "categ_b",
        })
        self.tag_b = self.env['documents.tag'].create({
            'facet_id': self.tag_category_b.id,
            'name': "tag_b",
        })
        self.tag_category_a = self.env['documents.facet'].create({
            'folder_id': self.folder_a.id,
            'name': "categ_a",
        })
        self.tag_category_a_a = self.env['documents.facet'].create({
            'folder_id': self.folder_a_a.id,
            'name': "categ_a_a",
        })
        self.tag_a_a = self.env['documents.tag'].create({
            'facet_id': self.tag_category_a_a.id,
            'name': "tag_a_a",
        })
        self.tag_a = self.env['documents.tag'].create({
            'facet_id': self.tag_category_a.id,
            'name': "tag_a",
        })
        self.attachment_gif = self.env['ir.attachment'].create({
            'datas': GIF,
            'name': 'Test mimetype gif',
            'datas_fname': 'file.gif',
            'mimetype': 'image/gif',
            'folder_id': self.folder_b.id,
        })
        self.attachment_txt = self.env['ir.attachment'].create({
            'datas': TEXT,
            'name': 'Test mimetype txt',
            'datas_fname': 'file.txt',
            'mimetype': 'text/plain',
            'folder_id': self.folder_b.id,
        })
        self.share_link_ids = self.env['documents.share'].create({
            'attachment_ids': [(4, self.attachment_txt.id, 0)],
            'type': 'ids',
            'name': 'share_link_ids',
            'folder_id': self.folder_a_a.id,
        })
        self.share_link_folder = self.env['documents.share'].create({
            'folder_id': self.folder_a_a.id,
            'name': "share_link_folder",
        })
        self.tag_action_a = self.env['documents.workflow.action'].create({
            'action': 'add',
            'facet_id': self.tag_category_b.id,
            'tag_id': self.tag_b.id,
        })
        self.worflow_rule = self.env['documents.workflow.rule'].create({
            'domain_folder_id': self.folder_a_a.id,
            'name': 'workflow rule on f_a_a',
            'folder_id': self.folder_b.id,
            'tag_action_ids': [(4, self.tag_action_a.id, 0)]
        })

    def test_documents_rules(self):
        """
        Tests a documents.workflow.rule
        """
        self.worflow_rule.apply_actions([self.attachment_gif.id, self.attachment_txt.id])
        self.assertTrue(self.tag_b.id in self.attachment_gif.tag_ids.ids, "failed at workflow rule add tag id")
        self.assertTrue(self.tag_b.id in self.attachment_txt.tag_ids.ids, "failed at workflow rule add tag id 2")
        self.assertEqual(len(self.attachment_gif.tag_ids.ids), 1, "failed at workflow rule add tag len")

        self.assertEqual(self.attachment_gif.folder_id.id, self.folder_b.id, "failed at workflow rule set folder gif")
        self.assertEqual(self.attachment_txt.folder_id.id, self.folder_b.id, "failed at workflow rule set folder txt")

    def test_documents_rule_display(self):
        """
        tests criteria of rules
        """
        self.tag_criteria_b = self.env['documents.workflow.tag.criteria'].create({
            'operator': 'contains',
            'facet_id': self.tag_category_b.id,
            'tag_id': self.tag_b.id,
        })

        self.tag_criteria_not_a_a = self.env['documents.workflow.tag.criteria'].create({
            'operator': 'notcontains',
            'facet_id': self.tag_category_a_a.id,
            'tag_id': self.tag_a_a.id,
        })

        self.workflow_rule_criteria = self.env['documents.workflow.rule'].create({
            'domain_folder_id': self.folder_a.id,
            'name': 'workflow rule on f_a & criteria',
            'condition_type': 'criteria',
            'criteria_tag_ids': [(6, 0, [self.tag_criteria_b.id, self.tag_criteria_not_a_a.id])]
        })

        self.attachment_txt_criteria_a = self.env['ir.attachment'].create({
            'datas': TEXT,
            'name': 'Test criteria a',
            'datas_fname': 'file.txt',
            'mimetype': 'text/plain',
            'folder_id': self.folder_a.id,
            'tag_ids': [(6, 0, [self.tag_a_a.id, self.tag_b.id])]
        })

        self.assertTrue(self.workflow_rule_criteria.id not in self.attachment_txt_criteria_a.available_rule_ids.ids,
                        "failed at documents_workflow_rule unavailable rule")

        self.attachment_txt_criteria_b = self.env['ir.attachment'].create({
            'datas': TEXT,
            'name': 'Test criteria b',
            'datas_fname': 'file.txt',
            'mimetype': 'text/plain',
            'folder_id': self.folder_a.id,
            'tag_ids': [(6, 0, [self.tag_a.id])]
        })

        self.assertTrue(self.workflow_rule_criteria.id not in self.attachment_txt_criteria_b.available_rule_ids.ids,
                        "failed at documents_workflow_rule unavailable rule")

        self.attachment_txt_criteria_c = self.env['ir.attachment'].create({
            'datas': TEXT,
            'name': 'Test criteria c',
            'datas_fname': 'file.txt',
            'mimetype': 'text/plain',
            'folder_id': self.folder_a.id,
            'tag_ids': [(6, 0, [self.tag_b.id])]
        })

        self.assertTrue(self.workflow_rule_criteria.id in self.attachment_txt_criteria_c.available_rule_ids.ids,
                        "failed at documents_workflow_rule available rule")

        self.attachment_txt_criteria_d = self.env['ir.attachment'].create({
            'datas': TEXT,
            'name': 'Test criteria d',
            'datas_fname': 'file.txt',
            'mimetype': 'text/plain',
            'folder_id': self.folder_b.id,
            'tag_ids': [(6, 0, [self.tag_b.id])]
        })

        self.assertTrue(self.workflow_rule_criteria.id not in self.attachment_txt_criteria_d.available_rule_ids.ids,
                        "failed at documents_workflow_rule unavailable rule")

    def test_documents_share_links(self):
        """
        Tests document share links
        """

        # by Folder
        vals = {
            'folder_id': self.folder_b.id,
            'domain': [],
            'tag_ids': [(6, 0, [])],
            'type': 'domain',
        }
        action_folder = self.env['documents.share'].create_share(vals)
        result_share_folder = self.env['documents.share'].search([('folder_id', '=', self.folder_b.id)])
        result_share_folder_act = self.env['documents.share'].browse(action_folder['res_id'])
        self.assertEqual(result_share_folder.id, result_share_folder_act.id, "failed at share link by folder")
        self.assertEqual(result_share_folder_act.type, 'domain', "failed at share link type domain")

        # by Attachments
        vals = {
            'attachment_ids': [(6, 0, [self.attachment_gif.id, self.attachment_txt.id])],
            'folder_id': self.folder_b.id,
            'type': 'ids',
        }
        action_attachments = self.env['documents.share'].create_share(vals)
        result_share_attachments_act = self.env['documents.share'].browse(action_attachments['res_id'])

        # Expiration date
        result_share_attachments_act.write({
            'date_deadline': '2015-01-01'
        })
        self.assertEqual(result_share_attachments_act.state, 'expired', "failed at share_link expiration by date")
