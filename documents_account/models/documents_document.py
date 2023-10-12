# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import binascii
import contextlib
from itertools import chain
from xml.etree import ElementTree

from odoo import api, fields, models


class DocumentsDocument(models.Model):
    _inherit = 'documents.document'

    # once we parsed the XML to know if a PDF is embedded inside,
    # we store that information so we don't need to parse it again
    has_embedded_pdf = fields.Boolean('Has Embedded PDF', compute='_compute_has_embedded_pdf', store=True)

    @api.depends('has_embedded_pdf')
    def _compute_thumbnail(self):
        """Compute the thumbnail and thumbnail status.

        If the XML invoices contain an embedded PDF, the thumbnail / thumbnail_status
        must have the same behavior as a standard PDF.
        """
        xml_documents = self.filtered(lambda doc: doc.has_embedded_pdf)
        xml_documents.thumbnail = False
        xml_documents.thumbnail_status = 'client_generated'
        super(DocumentsDocument, self - xml_documents)._compute_thumbnail()

    @api.depends('checksum')
    def _compute_has_embedded_pdf(self):
        for document in self:
            document.has_embedded_pdf = bool(document._extract_pdf_from_xml())

    def _extract_pdf_from_xml(self):
        """Parse the XML file and return the PDF content if one is found.

        For some invoice files (in the XML format), we can have a PDF embedded inside
        in base 64. We want to be able to preview it in documents.

        We support the UBL format
        > https://docs.peppol.eu/poacc/billing/3.0/syntax/ubl-invoice
        """
        self.ensure_one()

        if not self.mimetype or not self.mimetype.endswith('/xml'):
            return False

        try:
            xml_file_content = self.with_context(bin_size=False).raw.decode()
        except UnicodeDecodeError:
            return False

        # quick filters, to not parse the XML most of the cases
        if "EmbeddedDocumentBinaryObject" not in xml_file_content and "Attachment" not in xml_file_content:
            return False

        try:
            tree = ElementTree.fromstring(xml_file_content)
        except ElementTree.ParseError:
            return False

        attachment_nodes = tree.iterfind('.//{*}EmbeddedDocumentBinaryObject')
        attachment_nodes = chain(attachment_nodes, tree.iterfind('.//{*}Attachment'))

        for attachment_node in attachment_nodes:
            if next(attachment_node.iter(), None):  # the node has children
                continue

            with contextlib.suppress(TypeError, binascii.Error):
                # check file header in case many file are embedded in the XML
                if (pdf_attachment_content := base64.b64decode(attachment_node.text + "====")).startswith(b'%PDF-'):
                    return pdf_attachment_content

        return False
