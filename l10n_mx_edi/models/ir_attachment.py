from odoo import _, api, models
from odoo.exceptions import UserError


class IrAttachment(models.Model):
    _inherit = 'ir.attachment'

    @api.ondelete(at_uninstall=False)
    def _unlink_except_cfdi_document(self):
        has_cfdi_document = self.env['l10n_mx_edi.document'].sudo().search_count([('attachment_id', 'in', self.ids)], limit=1)
        if has_cfdi_document:
            raise UserError(_("You can't unlink an attachment being an EDI document sent to the government."))
