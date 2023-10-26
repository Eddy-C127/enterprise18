# -*- coding: utf-8 -*-

from odoo import api, fields, models


class IrView(models.Model):
    _inherit = 'ir.ui.view'

    l10n_mx_edi_addenda_flag = fields.Boolean(
        string='Is an addenda?',
        help='If True, the view is an addenda for the Mexican EDI invoicing.',
        default=False)

    fiscal_country_codes = fields.Char(compute="_compute_fiscal_country_codes")

    @api.depends_context('allowed_company_ids')
    def _compute_fiscal_country_codes(self):
        for record in self:
            record.fiscal_country_codes = ",".join(self.env.companies.mapped('account_fiscal_country_id.code'))
