# -*- coding: utf-8 -*-
from odoo import models, fields, api, exceptions

from werkzeug.urls import url_encode


class SignRequest(models.Model):
    _name = 'sign.request'
    _inherit = ['sign.request', 'documents.mixin']

    @api.model_create_multi
    def create(self, vals_list):
        sign_requets = super().create(vals_list)
        attachment_checksums = sign_requets.template_id.attachment_id.mapped('checksum')
        documents = self.env['documents.document'].search([('attachment_id.checksum', 'in', attachment_checksums)])
        doc_by_checksum = {}
        for doc in documents:
            doc_by_checksum[doc.checksum] = doc.id
        for sr in sign_requets:
            if sr.template_id.folder_id and not sr.reference_doc:
                # The Sign Request was created from the Document application
                doc_id = doc_by_checksum.get(sr.template_id.attachment_id.checksum)
                sr.reference_doc = doc_id and f"documents.document,{doc_id}"
        return sign_requets

    def _get_linked_record_action(self, default_action=None):
        self.ensure_one()
        if self.reference_doc._name == 'documents.document':
            url_params = url_encode({
                'model': 'documents.document',
                'action_id': self.env.ref("documents.document_action").id,
                'view_id': self.env.ref("documents.document_view_kanban").id,
                'menu_id': self.env.ref("documents.menu_root").id,
                'folder_id': self.reference_doc.folder_id.id,
            })
            return {
                'type': 'ir.actions.act_url',
                'url': f"/web?preview_id={self.reference_doc.id}#{url_params}",
                'target': 'self',
            }
        else:
            return super()._get_linked_record_action(default_action=default_action)

    def _get_document_tags(self):
        return self.template_id.documents_tag_ids

    def _get_document_folder(self):
        return self.template_id.folder_id
