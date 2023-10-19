# -*- coding: utf-8 -*-
from odoo import models


class AccountReportFileDownloadErrorWizard(models.TransientModel):
    _inherit = 'account.report.file.download.error.wizard'

    def action_invalid_code_moves(self, options, params):
        return self.env['account.intrastat.report.handler'].action_invalid_code_moves(options, params)

    def action_invalid_code_products(self, options, params):
        return self.env['account.intrastat.report.handler'].action_invalid_code_products(options, params)

    def action_invalid_transport_mode_moves(self, move_ids):
        return self.env['account.intrastat.report.handler'].action_invalid_transport_mode_moves(move_ids)

    def action_missing_intrastat_product_origin_country_code(self, move_line_ids):
        return self.env['account.intrastat.report.handler'].action_missing_intrastat_product_origin_country_code(move_line_ids)
