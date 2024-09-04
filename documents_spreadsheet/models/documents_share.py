# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import json

from odoo import api, Command, models, fields

class DocumentShare(models.Model):
    _inherit = "documents.share"

    freezed_spreadsheet_ids = fields.One2many(
        "documents.shared.spreadsheet", "share_id"
    )

    # technical field, used to create freezed_spreadsheet_ids
    spreadsheet_shares = fields.Char(inverse="_inverse_spreadsheet_shares", store=False)

    def _inverse_spreadsheet_shares(self):
        for share in self:
            create_commands = self._create_spreadsheet_share_commands(json.loads(share.spreadsheet_shares))
            share.write({"freezed_spreadsheet_ids": create_commands})

    def _get_documents_and_check_access(self, access_token, document_ids=None, operation="write"):
        available_documents = super()._get_documents_and_check_access(access_token, document_ids, operation)
        if operation == "write" and available_documents and not self.env.user._is_internal():
            return available_documents.filtered(lambda doc: doc.handler != "spreadsheet")
        return available_documents

    @api.model
    def _create_spreadsheet_share_commands(self, spreadsheet_shares):
        create_commands = []
        for share in spreadsheet_shares:
            excel_zip = self.env["spreadsheet.mixin"]._zip_xslx_files(
                share["excel_files"]
            )
            create_commands.append(
                Command.create(
                    {
                        "document_id": share["document_id"],
                        "spreadsheet_data": share["spreadsheet_data"],
                        "excel_export": base64.b64encode(excel_zip),
                    }
                )
            )
        return create_commands
