# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Chile - Accounting Reports',
    'version': '1.1',
    'category': 'Accounting',
    'description': """
        Accounting reports for Chile
    """,
    'depends': [
        'l10n_cl', 'account_reports',
    ],
    'data': [
        'views/eightcolumns_report_view.xml'
    ],
    'installable': True,
    'auto_install': True,
    'website': 'http://cubicERP.com',
    'license': 'OEEL-1',
}
