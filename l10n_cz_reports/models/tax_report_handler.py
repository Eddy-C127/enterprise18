from odoo import models, _


class CzechTaxReportCustomHandler(models.AbstractModel):
    """
        Generate the VAT report for the Czech Republic.
        Generated using as a reference the documentation at
        https://adisspr.mfcr.cz/dpr/adis/idpr_pub/epo2_info/popis_struktury_detail.faces?zkratka=DPHDP3
    """
    _name = 'l10n_cz.tax.report.handler'
    _inherit = 'account.tax.report.handler'
    _description = 'Czech Tax Report Custom Handler'

    def _custom_options_initializer(self, report, options, previous_options=None):
        super()._custom_options_initializer(report, options, previous_options=previous_options)

        options.setdefault('buttons', []).append({
            'name': _('XML'),
            'sequence': 30,
            'action': 'export_file',
            'action_param': 'export_to_xml',
            'file_export_type': _('XML'),
        })

    def _export_to_xml(self, options):
        """
        This method is overridden in l10n_cz_reports_2025
        with the actual exporting logic
        """
        raise NotImplementedError()

    def export_to_xml(self, options):
        if module := self.env['ir.module.module'].sudo().search([('name', '=', 'l10n_cz_reports_2025'), ('state', '=', 'uninstalled')]):
            module.button_immediate_install()

        return self._export_to_xml(options)
