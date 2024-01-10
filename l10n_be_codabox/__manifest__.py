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
        'security/l10n_be_codabox_security.xml',
        'views/res_config_settings_views.xml',
        'views/account_journal_views.xml',
        'wizard/soda_import_wizard.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'l10n_be_codabox/static/src/components/**/*',
        ],
    },
    'demo': [
        'demo/demo_data.xml',
    ],
    'license': 'OEEL-1',
}
