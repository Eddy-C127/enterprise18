# -*- coding: utf-8 -*-

from odoo import models
from odoo.tools import SQL


class AccountReconcileModel(models.Model):
    _inherit = 'account.reconcile.model'

    def _get_invoice_matching_batch_payments_candidates(self, st_line, partner):
        assert self.rule_type == 'invoice_matching'
        self.env['account.batch.payment'].flush_model()

        _numerical_tokens, _exact_tokens, text_tokens = self._get_invoice_matching_st_line_tokens(st_line)
        if not text_tokens:
            return

        batch_sequence_code = 'account.inbound.batch.payment' if st_line.amount > 0.0 else 'account.outbound.batch.payment'

        sequence_prefix = self.env['ir.sequence'].sudo()\
            .search(
                [('code', '=', batch_sequence_code), ('company_id', 'in', (st_line.company_id.id, False))],
                order='company_id',
                limit=1,
            )\
            .prefix
        if not sequence_prefix:
            return

        sequence_prefix = sequence_prefix.lower()
        text_tokens = [x.lower() for x in text_tokens if x.lower().startswith(sequence_prefix)]
        if not text_tokens:
            return

        aml_domain = self._get_invoice_matching_amls_domain(st_line, partner)
        query = self.env['account.move.line']._where_calc(aml_domain)

        additional_conditions = SQL(" OR ").join(
            SQL("%s ~ sub.name", token)
            for token in text_tokens
        )

        candidate_ids = [r[0] for r in self.env.execute_query(SQL(
            r'''
                WITH account_batch_payment_name AS (
                    SELECT DISTINCT
                        batch.id,
                        SUBSTRING(REGEXP_REPLACE(LOWER(batch.name), '[^0-9a-z\s]', '', 'g'), '\S(?:.*\S)*') AS name,
                        ARRAY_AGG(account_move_line.id) AS aml_ids
                    FROM %s
                    JOIN account_payment pay ON pay.id = account_move_line.payment_id
                    JOIN account_batch_payment batch ON
                        batch.id = pay.batch_payment_id
                        AND batch.state != 'reconciled'
                    WHERE %s
                    GROUP BY batch.id, batch.name
                )
                SELECT sub.aml_ids
                FROM account_batch_payment_name sub
                WHERE %s
            ''',
            query.from_clause,
            query.where_clause or SQL("TRUE"),
            additional_conditions or SQL("TRUE"),
        ))]
        if candidate_ids:
            return {
                'allow_auto_reconcile': True,
                'amls': self.env['account.move.line'].browse(candidate_ids),
            }

    def _get_invoice_matching_rules_map(self):
        # EXTENDS account
        res = super()._get_invoice_matching_rules_map()
        res[0].append(self._get_invoice_matching_batch_payments_candidates)
        return res
