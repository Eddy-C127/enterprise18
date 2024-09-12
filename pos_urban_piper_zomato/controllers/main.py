from odoo.addons.pos_urban_piper.controllers.main import PosUrbanPiperController
from odoo.http import request


class PosZomatoController(PosUrbanPiperController):

    def _get_tax_value(self, taxes):
        tax_id = super()._get_tax_value(taxes)
        if tax_id:
            return tax_id
        tax_lst = []
        for tax_line in taxes:
            tax = request.env['account.tax'].sudo().search([
                ('tax_group_id.name', '=', tax_line.get('title')),
                ('amount', '=', tax_line.get('rate'))
            ], limit=1)
            if tax:
                tax_lst.append(tax.id)
        parent_tax = request.env['account.tax'].sudo().search([('children_tax_ids', 'in', tax_lst)])
        return parent_tax
