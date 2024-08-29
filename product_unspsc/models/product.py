# coding: utf-8
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api
from odoo.osv import expression



class ProductTemplate(models.Model):
    _inherit = 'product.template'

    unspsc_code_id = fields.Many2one('product.unspsc.code', 'UNSPSC Category', domain=[('applies_to', '=', 'product')],
        help='The UNSPSC code related to this product.  Used for edi in Colombia, Peru, Mexico and Denmark')


class UomUom(models.Model):
    _inherit = 'uom.uom'

    unspsc_code_id = fields.Many2one('product.unspsc.code', 'UNSPSC Category',
                                                domain=[('applies_to', '=', 'uom')],
                                                help='The UNSPSC code related to this UoM. ')


class ProductCode(models.Model):
    """Product and UoM codes defined by UNSPSC
    Used by Mexico, Peru, Colombia and Denmark localizations
    """
    _name = 'product.unspsc.code'
    _description = "Product and UOM Codes from UNSPSC"
    _rec_names_search = ['name', 'code']

    code = fields.Char('Code', required=True)
    name = fields.Char('Name', required=True, translate=True)
    applies_to = fields.Selection([('product', 'Product'), ('uom', 'UoM'),], required=True,
        help='Indicate if this code could be used in products or in UoM',)
    active = fields.Boolean()

    @api.depends('code')
    def _compute_display_name(self):
        for prod in self:
            prod.display_name = f"{prod.code} {prod.name or ''}"

    @api.model
    def _name_search(self, name, domain=None, operator='ilike', limit=None, order=None):
        if name:
            if operator in ('=', '!='):
                name_domain = ['|', ('code', '=', name.split(' ')[0]), ('name', operator, name)]
            else:
                name_domain = ['|', ('code', '=like', name.split(' ')[0] + '%'), ('name', operator, name)]
            if operator in expression.NEGATIVE_TERM_OPERATORS:
                name_domain = ['&', '!'] + name_domain[1:]
            domain = expression.AND([name_domain, domain])
        return self._search(domain, limit=limit, order=order)
