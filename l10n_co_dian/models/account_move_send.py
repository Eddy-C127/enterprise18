from odoo import _, api, models


class AccountMoveSend(models.AbstractModel):
    _inherit = 'account.move.send'

    @api.model
    def _is_co_edi_applicable(self, move):
        return not move.invoice_pdf_report_id and move.l10n_co_dian_is_enabled

    def _get_all_extra_edis(self) -> dict:
        # EXTENDS 'account'
        res = super()._get_all_extra_edis()
        res.update({'co_dian': {'label': _("DIAN"), 'is_applicable': self._is_co_edi_applicable}})
        return res

    # -------------------------------------------------------------------------
    # ATTACHMENTS
    # -------------------------------------------------------------------------

    def _get_invoice_extra_attachments(self, move):
        # EXTENDS 'account'
        return super()._get_invoice_extra_attachments(move) + move.l10n_co_dian_attachment_id

    def _get_placeholder_mail_attachments_data(self, move, extra_edis=None):
        # EXTENDS 'account'
        results = super()._get_placeholder_mail_attachments_data(move, extra_edis=extra_edis)

        if not move.l10n_co_dian_attachment_id and 'co_dian' in extra_edis:
            filename = self.env['account.edi.xml.ubl_dian']._export_invoice_filename(move)
            results.append({
                'id': f'placeholder_{filename}',
                'name': filename,
                'mimetype': 'application/xml',
                'placeholder': True,
            })

        return results

    # -------------------------------------------------------------------------
    # SENDING METHODS
    # -------------------------------------------------------------------------

    def _call_web_service_before_invoice_pdf_render(self, invoices_data):
        # EXTENDS 'account'
        super()._call_web_service_before_invoice_pdf_render(invoices_data)

        for invoice, invoice_data in invoices_data.items():
            if 'co_dian' in invoice_data['extra_edis']:
                # Render
                xml, errors = self.env['account.edi.xml.ubl_dian']._export_invoice(invoice)
                if errors:
                    invoice_data['error'] = {
                        'error_title': _("Error(s) when generating the UBL attachment:"),
                        'errors': errors,
                    }
                    continue

                doc = invoice._l10n_co_dian_send_invoice_xml(xml)

                if doc.state in ('invoice_rejected', 'invoice_sending_failed'):
                    invoice_data['error'] = {
                        'error_title': _("Error(s) when sending the document to the DIAN:"),
                        'errors': doc.message_json.get('errors') or [doc.message_json['status']],
                    }

                if self._can_commit():
                    self._cr.commit()
