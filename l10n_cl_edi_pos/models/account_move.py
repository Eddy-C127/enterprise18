# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_cl_sii_barcode_image = fields.Char(string="SII Barcode Image", compute='_compute_l10n_cl_sii_barcode_image')

    def _compute_l10n_cl_sii_barcode_image(self):
        for record in self:
            record.l10n_cl_sii_barcode_image = False
            if record.l10n_cl_sii_barcode:
                record.l10n_cl_sii_barcode_image = record._pdf417_barcode(record.l10n_cl_sii_barcode)
