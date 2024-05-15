# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api


class HRPayslip(models.Model):
    _inherit = 'hr.payslip'

    def _get_data_files_to_update(self):
        # Note: file order should be maintained
        return super()._get_data_files_to_update() + [(
            'l10n_sa_hr_payroll', [
                'data/hr_salary_rule_saudi_data.xml',
                'data/hr_salary_rule_expat_data.xml',
            ])]

    @api.model
    def _l10n_sa_departure_reason_codes(self):
        return self.env['hr.departure.reason']._get_default_departure_reasons() | {
            'clause_77': 9661,
            'end_of_contract': 9662,
        }
