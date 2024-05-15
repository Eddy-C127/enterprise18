# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Australia - Payroll with Accounting',
    'category': 'Human Resources',
    'depends': [
        'l10n_au_hr_payroll',
        'hr_payroll_account',
        'l10n_au',
        "l10n_au_aba"
    ],
    'description': """
Accounting Data for Australian Payroll Rules.
=============================================
    """,

    'auto_install': True,
    'data': [
        "data/hr_salary_rules.xml",
        "data/account_chart_template_data.xml",
        "data/ir_sequence_data.xml",
        "data/res_partner.xml",
        "views/l10n_au_super_stream_views.xml",
        "views/hr_contract_views.xml",
        "views/hr_payslip_views.xml",
        "views/res_config_settings_views.xml",
        "security/ir.model.access.csv",
        "wizard/hr_payroll_aba_wizard_views.xml",
    ],
    'demo': [
        "data/l10n_au_hr_payroll_account_demo.xml",
    ],
    'license': 'OEEL-1',
}
