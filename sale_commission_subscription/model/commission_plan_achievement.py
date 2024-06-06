# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from odoo.exceptions import UserError


class CommissionPlanAchievement(models.Model):
    _inherit = 'sale.commission.plan.achievement'

    type = fields.Selection(selection_add=[('mrr', "MRR")], ondelete={'mrr': 'cascade'})

    @api.constrains('type', 'product_id', 'product_categ_id')
    def _constrains_type_mrr(self):
        impossible = self.filtered(lambda pa: pa.type == 'mrr' and (pa.product_id or pa.product_categ_id))
        if impossible:
            raise UserError(_("You cannot have Product or Category constraints on MRR achievements. "))
