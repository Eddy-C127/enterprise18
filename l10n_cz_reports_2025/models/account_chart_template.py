from odoo import models
from odoo.addons.account.models.chart_template import template


class AccountChartTemplate(models.AbstractModel):
    _inherit = 'account.chart.template'

    @template('cz', 'account.tax')
    def _get_cz_control_statement_account_tax(self):
        return self._parse_csv('cz', 'account.tax', module='l10n_cz_reports_2025')
