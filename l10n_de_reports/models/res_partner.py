# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError
from odoo.tools import SQL


class ResPartner(models.Model):
    _inherit = 'res.partner'

    l10n_de_datev_identifier = fields.Integer(
        string='DateV Vendor',
        copy=False,
        tracking=True,
        company_dependent=True,
        index='btree_not_null',
        help="In the DateV export of the General Ledger, each vendor will be identified by this identifier. "
        "If this identifier is not set, the database id of the partner will be added to a multiple of ten starting by the number 7."
        "The account code's length can be specified in the company settings."
    )
    l10n_de_datev_identifier_customer = fields.Integer(
        string='DateV Customer',
        copy=False,
        tracking=True,
        company_dependent=True,
        index='btree_not_null',
        help="In the DateV export of the General Ledger, each customer will be identified by this identifier. "
        "If this identifier is not set, the database id of the partner will be added to a multiple of ten starting by the number 1."
        "The account code's length can be specified in the company settings."
    )

    @api.constrains('l10n_de_datev_identifier')
    def _check_datev_identifier(self):
        self.flush_model(['l10n_de_datev_identifier'])
        self.env.cr.execute(SQL("""
            SELECT 1
            FROM ir_property property JOIN res_company company ON property.company_id = company.id
            WHERE property.name = 'l10n_de_datev_identifier' AND property.company_id = %(company_id)s
            HAVING count(*) > 1
        """, company_id=self.env.company.id))

        if self.env.cr.dictfetchone():
            raise ValidationError(_('You have already defined a partner with the same Datev identifier. '))

    @api.constrains('l10n_de_datev_identifier_customer')
    def _check_datev_identifier_customer(self):
        self.flush_model(['l10n_de_datev_identifier_customer'])
        self.env.cr.execute(SQL("""
            SELECT 1
            FROM ir_property property JOIN res_company company ON property.company_id = company.id
            WHERE property.name = 'l10n_de_datev_identifier_customer' AND property.company_id = %(company_id)s
            HAVING count(*) > 1
        """, company_id=self.env.company.id))

        if self.env.cr.dictfetchone():
            raise ValidationError(_('You have already defined a partner with the same Datev Customer identifier'))
