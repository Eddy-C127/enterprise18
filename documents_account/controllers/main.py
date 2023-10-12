# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.addons.documents.controllers.documents import ShareRoute


class AccountShareRoute(ShareRoute):

    def _get_file_response(self, document_id, *args, is_document_preview=False, **kwargs):
        """Return the embedded PDF content if any."""
        document = http.request.env['documents.document'].browse(int(document_id))
        if is_document_preview and document.has_embedded_pdf:
            embedded_pdf = document._extract_pdf_from_xml()
            headers = [
                ('Content-Type', 'application/pdf'),
                ('X-Content-Type-Options', 'nosniff'),
                ('Content-Length', len(embedded_pdf)),
                ('Content-Disposition', http.content_disposition(f"{document.name}.pdf")),
            ]
            return http.request.make_response(embedded_pdf, headers)
        return super()._get_file_response(document_id, *args, **kwargs)
