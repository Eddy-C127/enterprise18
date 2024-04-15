# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Netherlands - SBR Status information service',
    'countries': ['nl'],
    'version': '0.3',
    'category': 'Accounting/Localizations/SBR',
    'summary': 'Adds the use of a service checking the status of the submitted documents to Digipoort',
    'description': """
SBR Dutch Localization Status information service
==================================================
Adds the service that will check on the status of a submitted report to Digipoort
    """,
    'depends': ['l10n_nl_reports_sbr'],
    'external_dependencies': {
        'python': ['zeep'],
    },
    'data': [
        'data/cron.xml',
        'security/ir.model.access.csv',
        'views/l10n_nl_sbr_tax_report_view.xml',
        'views/l10n_nl_sbr_icp_wizard_view.xml',
    ],
    'auto_install': ['l10n_nl_reports_sbr'],
    'installable': True,
    'license': 'OEEL-1',
}
