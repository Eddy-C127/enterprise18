# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
from odoo import api, fields, models

class Planning(models.Model):
    _inherit = 'planning.slot'

    @api.model
    def gantt_resource_employees_working_periods(self, rows):
        if not self.env.user.has_group('planning.group_planning_manager'):
            return rows
        start_time = fields.Datetime.to_datetime(self._context.get('default_start_datetime'))
        end_time = fields.Datetime.to_datetime(self._context.get('default_end_datetime'))
        row_per_employee_id = {}
        for row in rows:
            if ("rows" in row):
                row["rows"] = self.gantt_resource_employees_working_periods(row["rows"])
                continue
            resource_dict = next((item["resource_id"] for item in json.loads(row["id"]) if "resource_id" in item), None)
            if not resource_dict:
                continue
            resource = self.env["resource.resource"].browse(resource_dict[0])
            if not resource.employee_id:
                continue
            row['working_periods'] = []
            row_per_employee_id[resource.employee_id.id] = row
        if row_per_employee_id:
            employee_ids = list(row_per_employee_id.keys())
            contracts = self.env['hr.employee'].browse(employee_ids).sudo()._get_contracts(start_time, end_time, ['open', 'close'])
            for contract in contracts:
                row_per_employee_id[contract.employee_id.id]["working_periods"].append({
                    "start": fields.Datetime.to_string(contract.date_start),
                    "end": fields.Datetime.to_string(contract.date_end),
                })
        return rows
