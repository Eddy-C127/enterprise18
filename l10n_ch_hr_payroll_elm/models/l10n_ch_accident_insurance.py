# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class l10nChAccidentInsurance(models.Model):
    _inherit = "l10n.ch.accident.insurance"

    insurance_company = fields.Char(required=True, store=True)
    insurance_code = fields.Char(required=True, store=True, compute=False)
