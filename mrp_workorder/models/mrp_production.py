# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _
from odoo.exceptions import UserError


class MrpProduction(models.Model):
    _inherit = 'mrp.production'
    _start_name = "date_planned_start"
    _stop_name = "date_planned_finished"

    check_ids = fields.One2many('quality.check', 'production_id', string="Checks")

    def _split_productions(self, amounts=False, cancel_remaning_qty=False):
        productions = super()._split_productions(amounts=amounts, cancel_remaning_qty=cancel_remaning_qty)
        backorders = productions[1:]
        if not backorders:
            return productions
        for wo in backorders.workorder_ids:
            if wo.component_id:
                wo._update_component_quantity()
        return productions

    def _button_mark_done_sanity_checks(self):
        self.workorder_ids._check_remaining_quality_checks()
        return super()._button_mark_done_sanity_checks()
