# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.tools import get_lang, SQL

class FuenteReportCustomHandler(models.AbstractModel):
    _name = 'l10n_co.fuente.report.handler'
    _inherit = 'l10n_co.report.handler'
    _description = 'Fuente Report Custom Handler'

    def _dynamic_lines_generator(self, report, options, all_column_groups_expression_totals, warnings=None):
        domain = self._get_domain(report, options)
        query_results = self._get_query_results(report, options, domain)
        return super()._get_partner_values(report, options, query_results, '_report_expand_unfoldable_line_fuente')

    def _get_query_results(self, report, options, domain, account=False):
        queries = []
        lang = self.env.user.lang or get_lang(self.env).code
        account_name = self.with_context(lang=lang).env['account.account']._field_to_sql('aa', 'name')
        for column_group_key, column_group_options in report._split_options_per_column_group(options).items():
            table_references, search_condition = report._get_table_expression(column_group_options, 'strict_range', domain=domain)
            tax_base_amount_select = SQL("""
                SUM(CASE
                    WHEN account_move_line.credit > 0
                        THEN account_move_line.tax_base_amount
                    WHEN account_move_line.debit > 0
                        THEN account_move_line.tax_base_amount * -1
                    ELSE 0
                    END)
            """)
            queries.append(SQL(
                """
                SELECT
                    %(column_group_key)s AS column_group_key,
                    SUM(account_move_line.credit - account_move_line.debit) AS balance,
                    %(tax_base_amount_select)s AS tax_base_amount,
                    %(account_name)s
                    %(account_id)s
                    rp.id AS partner_id,
                    rp.name AS partner_name
                FROM %(table_references)s
                JOIN res_partner rp ON account_move_line.partner_id = rp.id
                JOIN account_account aa ON account_move_line.account_id = aa.id
                WHERE %(search_condition)s
                GROUP BY rp.id %(group_by_account_id)s
                %(having_clause)s
                """,
                column_group_key=column_group_key,
                tax_base_amount_select=tax_base_amount_select,
                account_name=SQL("aa.code || ' ' || %s AS account_name,", account_name) if account else SQL(),
                account_id=SQL("aa.id AS account_id,") if account else SQL(),
                table_references=table_references,
                search_condition=search_condition,
                group_by_account_id=SQL(', aa.id') if account else SQL(),
                having_clause=SQL("HAVING %s != 0", tax_base_amount_select) if account else SQL(),
            ))

        self._cr.execute(SQL(' UNION ALL ').join(queries))
        return self._cr.dictfetchall()

    def _get_domain(self, report, options, line_dict_id=None):
        domain = super()._get_domain(report, options, line_dict_id=line_dict_id)
        domain += [('account_id.code', '=like', '2365%'), ('account_id.code', '!=', '236505')]
        return domain

    def _report_expand_unfoldable_line_fuente(self, line_dict_id, groupby, options, progress, offset, unfold_all_batch_data=None):
        report = self.env['account.report'].browse(options['report_id'])
        domain = self._get_domain(report, options, line_dict_id=line_dict_id)
        query_results = self._get_query_results(report, options, domain, account=True)
        return super()._get_grouped_values(report, options, query_results, group_by='account_id')
