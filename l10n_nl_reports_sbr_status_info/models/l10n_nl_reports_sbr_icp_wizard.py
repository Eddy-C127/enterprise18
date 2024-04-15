from odoo import models

class L10nNlICPSBRWizard(models.TransientModel):
    _inherit = 'l10n_nl_reports_sbr_icp.icp.wizard'

    def _additional_processing(self, kenmerk, closing_move):
        # OVERRIDE
        self.env['l10n_nl_reports_sbr.status.service'].create({
            'kenmerk': kenmerk,
            'company_id': self.env.company.id,
            'report_name': 'ICP report',
            'closing_entry_id': closing_move.id,
            'is_test': self.is_test,
        })._cron_process_submission_status()
