from odoo import api, SUPERUSER_ID

def migrate(cr, version):
    env = api.Environment(cr, SUPERUSER_ID, {})
    env.ref('l10n_fr_reports.account_financial_report_line_02_0_6_fr_bilan_passif_balance').unlink()
