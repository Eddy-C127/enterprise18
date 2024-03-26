from odoo import fields, models


class AccountJournal(models.Model):
    _inherit = 'account.journal'

    l10n_co_dian_technical_key = fields.Char(string="Technical control key", help="Control key acquired in the DIAN portal, used to generate the CUFE")
    l10n_co_dian_provider = fields.Selection(related='company_id.l10n_co_dian_provider')
