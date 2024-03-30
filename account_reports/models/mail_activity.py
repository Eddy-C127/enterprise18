# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class AccountTaxReportActivity(models.Model):
    _inherit = "mail.activity"

    def action_open_tax_activity(self):
        self.ensure_one()
        move = self.env['account.move'].browse(self.res_id)
        if self.activity_type_id == self.env.ref('account_reports.mail_activity_type_tax_report_to_pay'):
            return move._action_tax_to_pay_wizard()
        return move.action_open_tax_report()
