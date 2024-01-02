# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class StockMove(models.Model):
    _inherit = 'stock.move'

    @api.depends('workorder_id')
    def _compute_manual_consumption(self):
        super()._compute_manual_consumption()
        for move in self:
            if move.product_id in move.workorder_id.check_ids.component_id:
                move.manual_consumption = True

    def _action_assign(self, force_qty=False):
        res = super()._action_assign(force_qty=force_qty)
        for workorder in self.raw_material_production_id.workorder_ids:
            for check in workorder.check_ids:
                if check.test_type not in ('register_consumed_materials', 'register_byproducts'):
                    continue
                if check.move_line_id:
                    continue
                check.write(workorder._defaults_from_move(check.move_id))
        return res

    @api.ondelete(at_uninstall=False)
    def _unlink_quality_check(self):
        self.env['quality.check'].search([('move_id', 'in', self.ids)]).unlink()
