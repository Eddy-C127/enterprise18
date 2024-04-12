# coding: utf-8
{
    "name": "NACHA Payments",
    "summary": """Export payments as NACHA files""",
    "category": "Accounting/Accounting",
    "description": """
Export payments as NACHA files for use in the United States.
    """,
    "version": "1.0",
    "depends": ["account_batch_payment", "l10n_us"],
    "data": [
        "data/l10n_us_payment_nacha.xml",
        "views/account_journal_views.xml",
    ],
    "auto_install": ["l10n_us"],
    "license": "OEEL-1",
}
