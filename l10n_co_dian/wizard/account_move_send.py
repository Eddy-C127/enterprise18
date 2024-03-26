from odoo import models, fields, api, _


class AccountMoveSend(models.TransientModel):
    _inherit = 'account.move.send'

    l10n_co_dian_enable_xml = fields.Boolean(compute='_compute_l10n_co_dian_enable_xml')
    l10n_co_dian_checkbox_xml = fields.Boolean(
        string="DIAN",
        compute='_compute_l10n_co_dian_checkbox_xml',
        store=True,
        readonly=False,
    )

    def _get_wizard_values(self):
        # EXTENDS 'account'
        values = super()._get_wizard_values()
        values['l10n_co_dian'] = self.l10n_co_dian_checkbox_xml
        return values

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('move_ids')
    def _compute_l10n_co_dian_enable_xml(self):
        """ Whether the DIAN checkbox will be visible on the Send & Print wizard. """
        for wizard in self:
            wizard.l10n_co_dian_enable_xml = any(
                not move.invoice_pdf_report_id and move.l10n_co_dian_is_enabled for move in wizard.move_ids
            )

    @api.depends('l10n_co_dian_checkbox_xml')
    def _compute_mail_attachments_widget(self):
        # EXTENDS 'account' - add depends
        super()._compute_mail_attachments_widget()

    @api.depends('l10n_co_dian_enable_xml')
    def _compute_l10n_co_dian_checkbox_xml(self):
        for wizard in self:
            wizard.l10n_co_dian_checkbox_xml = wizard.l10n_co_dian_enable_xml

    # -------------------------------------------------------------------------
    # ATTACHMENTS
    # -------------------------------------------------------------------------

    @api.model
    def _get_invoice_extra_attachments(self, move):
        # EXTENDS 'account'
        return super()._get_invoice_extra_attachments(move) + move.l10n_co_dian_attachment_id

    def _get_placeholder_mail_attachments_data(self, move):
        # EXTENDS 'account'
        results = super()._get_placeholder_mail_attachments_data(move)

        if not move.l10n_co_dian_attachment_id and self.l10n_co_dian_enable_xml and self.l10n_co_dian_checkbox_xml:
            filename = self.env['account.edi.xml.ubl_dian']._export_invoice_filename(move)
            results.append({
                'id': f'placeholder_{filename}',
                'name': filename,
                'mimetype': 'application/xml',
                'placeholder': True,
            })

        return results

    # -------------------------------------------------------------------------
    # BUSINESS ACTIONS
    # -------------------------------------------------------------------------

    def _call_web_service_before_invoice_pdf_render(self, invoices_data):
        # EXTENDS 'account'
        super()._call_web_service_before_invoice_pdf_render(invoices_data)

        for invoice, invoice_data in invoices_data.items():
            if invoice_data.get('l10n_co_dian'):
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
