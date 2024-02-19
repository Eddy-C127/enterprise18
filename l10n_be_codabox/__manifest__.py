# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'CodaBox',
    'version': '1.0',
    'author': 'Odoo',
    'website': 'https://www.odoo.com/documentation/master/applications/finance/fiscal_localizations/belgium.html#codabox',
    'category': 'Accounting/Localizations',
    'description': 'CodaBox integration to retrieve your CODA and SODA files.',
    'depends': [
        'l10n_be_coda',
        'l10n_be_soda',
        'l10n_be_reports',
    ],
    'auto_install': True,
    'data': [
        'data/ir_cron.xml',
        'security/ir.model.access.csv',
        'views/res_config_settings_views.xml',
        'views/account_journal_views.xml',
        'wizard/connection_wizard.xml',
        'wizard/soda_import_wizard.xml',
        'wizard/validation_wizard.xml',
    ],
    'license': 'OEEL-1',
}
