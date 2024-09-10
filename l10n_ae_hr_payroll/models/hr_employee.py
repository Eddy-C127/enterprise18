# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime

from odoo import models


class HrEmployee(models.Model):
    _inherit = "hr.employee"

    def _l10n_ae_get_worked_years(self):
        self.ensure_one()
        if self.contract_id.date_start and self.contract_id.date_end:
            start_datetime = datetime.combine(self.contract_id.first_contract_date, datetime.min.time())
            end_datetime = datetime.combine(self.contract_id.date_end, datetime.max.time())
            return self._get_work_days_data_batch(start_datetime, end_datetime)[self.id]["days"] / 365
        return 0
