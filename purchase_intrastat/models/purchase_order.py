# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class PurchaseOrder(models.Model):
    _inherit = "purchase.order"

    def _prepare_account_move_values(self):
        res = super()._prepare_account_move_values()
        if self.partner_id.country_id.intrastat:
            res["intrastat_country_id"] = self.partner_id.country_id.id
        return res
