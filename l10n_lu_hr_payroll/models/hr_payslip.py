# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from datetime import date


class HrPayslip(models.Model):
    _inherit = 'hr.payslip'

    def _get_data_files_to_update(self):
        # Note: file order should be maintained
        return super()._get_data_files_to_update() + [(
            'l10n_lu_hr_payroll', [
                'data/hr_salary_rule_category_data.xml',
                'data/hr_payroll_structure_type_data.xml',
                'data/hr_payroll_structure_data.xml',
                'data/hr_rule_parameters_data.xml',
                'data/hr_salary_rule_data.xml',
                'data/hr_thirteen_month_rule_data.xml',
            ])]

    def _get_rule_name(self, localdict, rule, employee_lang):
        if rule.struct_id.country_id.code == 'LU' and rule.struct_id.code == 'LUXTHIRTEEN':
            if rule.code == 'BASIC':
                return 'Basic Gratification'
            elif rule.code == 'GROSS':
                return 'Gross Gratification'
            elif rule.code == 'NET':
                return 'Net Gratification'
        return super()._get_rule_name(localdict, rule, employee_lang)

    def _get_paid_amount(self):
        self.ensure_one()
        if self.struct_id.country_id.code == 'LU' and self.struct_id.code == 'LUXTHIRTEEN':
            return self._get_paid_amount_l10n_lu_13th_month()
        return super()._get_paid_amount()

    def _get_l10n_lux_presence_prorata(self, year, contracts):
        start_of_year = date(year, 1, 1)
        end_of_year = date(year, 12, 31)
        days_in_year = (end_of_year - start_of_year).days + 1

        unpaid_work_entry_types = self.struct_id.unpaid_work_entry_type_ids
        paid_work_entry_types = self.env['hr.work.entry.type'].search([('id', 'not in', unpaid_work_entry_types.ids)])

        ratio = 0
        for contract in contracts:
            start = max(contract.date_start, start_of_year)
            end = min(contract.date_end, end_of_year) if contract.date_end else end_of_year
            number_of_days = (end - start).days + 1
            duration_ratio = number_of_days / days_in_year
            work_time_ratio = contract.resource_calendar_id.work_time_rate / 100

            hours = contract.get_work_hours(start, end)
            paid_hours = 0
            overall_hours = 0
            for work_entry_type, work_hours in hours.items():
                if work_entry_type in paid_work_entry_types.ids:
                    paid_hours += work_hours
                overall_hours += work_hours
            presence_ratio = paid_hours / overall_hours
            ratio += duration_ratio * work_time_ratio * presence_ratio
        return round(ratio, 4)

    def _get_paid_amount_l10n_lu_13th_month(self):
        if not self.contract_id.l10n_lu_13th_month:
            return 0

        year = self.date_from.year
        contracts = self.employee_id.contract_ids.filtered_domain([
            ('l10n_lu_13th_month', '=', True),
            '|',
            ('state', 'in', ['open', 'close']),
            '&',
            ('state', '=', 'draft'),
            ('kanban_state', '=', 'done'),
            ('date_start', '<=', date(year, 12, 31)),
            '|',
            ('date_end', '>=', date(year, 1, 1)),
            ('date_end', '=', False),
        ])
        ratio = self._get_l10n_lux_presence_prorata(year, contracts)
        return (self.contract_id.wage * ratio) / (self.contract_id.resource_calendar_id.work_time_rate / 100)
