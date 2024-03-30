# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from dateutil.relativedelta import relativedelta

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
            employees_sudo = self.env["hr.employee"].browse(row_per_employee_id.keys()).sudo()
            employees_with_contract = dict(
                self.env["hr.contract"].sudo()._read_group(
                    domain=[
                        ("employee_id", "in", employees_sudo.ids),
                        "|",
                        ("state", "not in", ["draft", "cancel"]),
                        "&",
                        ("state", "=", "draft"),
                        ("kanban_state", "=", "done"),
                    ],
                    groupby=["employee_id"],
                    aggregates=["__count"],
                )
            )
            contracts = employees_sudo._get_contracts(start_time, end_time, ["draft", "open", "close"])
            employees_with_contract_in_current_scale = []
            for contract in contracts:
                if contract.state == 'draft' and contract.kanban_state != 'done':
                    continue
                employee = contract.employee_id.id
                employees_with_contract_in_current_scale.append(employee)
                row_per_employee_id[employee]["working_periods"].append({
                    "start": fields.Datetime.to_string(contract.date_start),
                    "end": contract.date_end and fields.Datetime.to_string(contract.date_end + relativedelta(hour=23, minute=59, second=59)),
                })
            for employee in employees_sudo - self.env["hr.employee"].browse(employees_with_contract_in_current_scale):
                if employees_with_contract.get(employee, 0):
                    continue
                row_per_employee_id[employee.id]["working_periods"].append({
                    "start": self.env.context.get("default_start_datetime"),
                    "end": self.env.context.get("default_end_datetime"),
                })
        return rows
