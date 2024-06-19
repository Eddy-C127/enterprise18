from .common import TestAccountReportsCommon

from odoo import Command
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestReportEngines(TestAccountReportsCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.company_data['company'].totals_below_sections = False

        cls.account_1 = cls.company_data['default_account_revenue']
        cls.account_2 = cls.copy_account(cls.account_1)
        cls.account_3 = cls.copy_account(cls.account_1)
        cls.account_4 = cls.copy_account(cls.account_1)

        # Create a test report
        cls.report = cls.env['account.report'].create({
            'name': "Budget Test",
            'filter_date_range': True,
            'filter_budgets': True,
            'filter_period_comparison': True,
            'column_ids': [
                Command.create({
                    'name': "Balance",
                    'expression_label': 'balance',
                }),
            ],
            'line_ids': [
                Command.create({
                    'name': 'line_domain',
                    'groupby': 'account_id',
                    'foldable': False,
                    'expression_ids': [
                        Command.create({
                            'label': 'balance',
                            'formula': "[('account_id.account_type', '=', 'income')]",
                            'subformula': 'sum',
                            'engine': 'domain',
                        }),
                    ],
                }),
                Command.create({
                    'name': 'line_account_codes',
                    'groupby': 'account_id',
                    'foldable': False,
                    'expression_ids': [
                        Command.create({
                            'label': 'balance',
                            'formula': cls.account_1.code[:3],
                            'engine': 'account_codes',
                        }),
                    ],
                }),
            ],
        })

        # Make a test account.move for this report
        cls.env['account.move'].create({
            'date': '2020-01-01',
            'journal_id': cls.company_data['default_journal_misc'].id,
            'line_ids': [
                Command.create({
                    'account_id': cls.account_1.id,
                    'debit': 100,
                }),
                Command.create({
                    'account_id': cls.account_2.id,
                    'debit': 200,
                }),
                Command.create({
                    'account_id': cls.account_3.id,
                    'debit': 300,
                }),
                Command.create({
                    'account_id': cls.company_data['default_account_assets'].id,
                    'credit': 600,
                }),
            ],
        }).action_post()

        # Create budgets
        cls.budget_1 = cls.env['account.report.budget'].create({
            'name': "Dudu",
            'item_ids': [
                Command.create({
                    'account_id': cls.account_1.id,
                    'amount': 1000,
                }),
                Command.create({
                    'account_id': cls.account_3.id,
                    'amount': 100,
                }),
                Command.create({
                    'account_id': cls.account_4.id,
                    'amount': 10,
                }),
            ],
        })

        cls.budget_2 = cls.env['account.report.budget'].create({
            'name': "Toto",
            'item_ids': [
                Command.create({
                    'account_id': cls.account_2.id,
                    'amount': 10,
                }),
            ],
        })

    def test_reports_single_budget(self):
        options = self._generate_options(
            self.report,
            '2020-01-01',
            '2020-01-01',
            default_options={'budgets': [{'id': self.budget_1.id, 'selected': True}]},
        )

        lines = self.report._get_lines(options)
        self.assertLinesValues(
            lines,
            [   0,                                             1,        2],
            [
                ('line_domain',                              600,     1110),
                (self.account_1.display_name,                100,     1000),
                (self.account_2.display_name,                200,        0),
                (self.account_3.display_name,                300,      100),
                (self.account_4.display_name,                  0,       10),
                ('line_account_codes',                       600,     1110),
                (self.account_1.display_name,                100,     1000),
                (self.account_2.display_name,                200,        0),
                (self.account_3.display_name,                300,      100),
                (self.account_4.display_name,                  0,       10),
            ],
            options,
        )

        self.assertColumnPercentComparisonValues(
            lines,
            [
                ('line_domain',                          '54.1%',  'green'),
                (self.account_1.display_name,            '10.0%',  'green'),
                (self.account_2.display_name,              'n/a',  'muted'),
                (self.account_3.display_name,           '300.0%',    'red'),
                (self.account_4.display_name,             '0.0%',  'green'),
                ('line_account_codes',                   '54.1%',  'green'),
                (self.account_1.display_name,            '10.0%',  'green'),
                (self.account_2.display_name,              'n/a',  'muted'),
                (self.account_3.display_name,           '300.0%',    'red'),
                (self.account_4.display_name,             '0.0%',  'green'),
            ]
        )

    def test_reports_multiple_budgets(self):
        options = self._generate_options(
            self.report,
            '2020-01-01',
            '2020-01-01',
            default_options={'budgets': [{'id': self.budget_1.id, 'selected': True}, {'id': self.budget_2.id, 'selected': True}]},
        )

        lines = self.report._get_lines(options)
        self.assertLinesValues(
            lines,
            [   0,                                             1,        2,        3],
            [
                ('line_domain',                              600,     1110,       10),
                (self.account_1.display_name,                100,     1000,        0),
                (self.account_2.display_name,                200,        0,       10),
                (self.account_3.display_name,                300,      100,        0),
                (self.account_4.display_name,                  0,       10,        0),
                ('line_account_codes',                       600,     1110,       10),
                (self.account_1.display_name,                100,     1000,        0),
                (self.account_2.display_name,                200,        0,       10),
                (self.account_3.display_name,                300,      100,        0),
                (self.account_4.display_name,                  0,       10,        0),
            ],
            options,
        )

        self.assertTrue(all('column_percent_comparison_data' not in line for line in lines))

    def test_reports_budget_comparison(self):
        self.env['account.move'].create({
            'date': '2019-01-01',
            'journal_id': self.company_data['default_journal_misc'].id,
            'line_ids': [
                Command.create({
                    'account_id': self.account_1.id,
                    'debit': 500,
                }),
                Command.create({
                    'account_id': self.account_3.id,
                    'credit': 300,
                }),
                Command.create({
                    'account_id': self.company_data['default_account_assets'].id,
                    'credit': 200,
                }),
            ],
        }).action_post()

        options = self._generate_options(
            self.report,
            '2020-01-01',
            '2020-01-01',
            default_options={'budgets': [{'id': self.budget_1.id, 'selected': True}], 'comparison': {'filter': 'same_last_year', 'number_period': 1}},
        )

        lines = self.report._get_lines(options)
        self.assertLinesValues(
            lines,
            [   0,                                             1,        2,        3],
            [
                ('line_domain',                              600,      200,     1110),
                (self.account_1.display_name,                100,      500,     1000),
                (self.account_2.display_name,                200,        0,        0),
                (self.account_3.display_name,                300,     -300,      100),
                (self.account_4.display_name,                  0,        0,       10),
                ('line_account_codes',                       600,      200,     1110),
                (self.account_1.display_name,                100,      500,     1000),
                (self.account_2.display_name,                200,        0,        0),
                (self.account_3.display_name,                300,     -300,      100),
                (self.account_4.display_name,                  0,        0,       10),
            ],
            options,
        )

        self.assertTrue(all('column_percent_comparison_data' not in line for line in lines))
