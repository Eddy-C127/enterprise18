# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime, time

from odoo import models


class PlanningRecurrency(models.Model):
    _inherit = 'planning.recurrency'

    def _get_misc_recurrence_stop(self):
        res = super()._get_misc_recurrence_stop()
        initial_slot = self.slot_ids.sorted('end_datetime')[0]
        contract = self.slot_ids.resource_id.employee_id.contract_ids.filtered(lambda c: c.state == 'open' and c.date_end)
        end_contract = datetime.combine(contract.date_end, time.max) if contract and contract.date_end else res
        # If the initial slot that we are repeating is planned after the end of the resource contract, we generate the slots
        # on out-of-contract dates normally.
        if initial_slot.start_datetime > end_contract:
            return res
        return min(end_contract, res)
