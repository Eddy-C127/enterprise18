# -*- coding: utf-8 -*-

import re

from odoo import _, http
from odoo.http import request
from odoo.exceptions import AccessError, MissingError, ValidationError
from odoo.addons.documents.controllers.documents import ShareRoute

class SpreadsheetShareRoute(ShareRoute):

    @classmethod
    def _get_downloadable_documents(cls, documents):
        """
            override of documents to prevent the download
            of spreadsheets binary as they are not usable
        """
        return super()._get_downloadable_documents(documents.filtered(lambda doc: doc.mimetype != "application/o-spreadsheet"))

    def _create_uploaded_documents(self, *args, **kwargs):
        documents = super()._create_uploaded_documents(*args, **kwargs)
        if any(doc.handler == "spreadsheet" for doc in documents):
            raise AccessError(_("You cannot upload spreadsheets in a shared folder"))
        return documents

    @classmethod
    def _get_share_zip_data_stream(cls, share, document):
        if document.handler == "spreadsheet":
            spreadsheet_copy = share.freezed_spreadsheet_ids.filtered(
                lambda s: s.document_id == document
            )
            try:
                return request.env["ir.binary"]._get_stream_from(
                    spreadsheet_copy, "excel_export", filename=document.name
                )
            except MissingError:
                return False
        return super()._get_share_zip_data_stream(share, document)

    @http.route()
    def upload_document(self, *args, **kwargs):
        response = super().upload_document(*args, **kwargs)
        document_ids = response.json.get("ids")
        documents = request.env["documents.document"].browse(document_ids)
        # ends with .osheet.json or .osheet (6).json
        match_regex = r"\.osheet(\s?\(\d+\))?\.json$"
        spreadsheets = documents.filtered(lambda doc: doc.name and re.search(match_regex, doc.name) and doc.mimetype == "application/json")
        spreadsheets.handler = "spreadsheet"
        try:
            spreadsheets._check_spreadsheet_data()
        except ValidationError as e:
            return request.make_json_response({
                "error": str(e)
            })
        return response
