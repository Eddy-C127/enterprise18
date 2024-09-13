# -*- coding: utf-8 -*-
from unittest.mock import patch

from odoo import Command
from odoo.addons.account_accountant.tests.test_bank_rec_widget_common import TestBankRecWidgetCommon
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestBankRecWidget(TestBankRecWidgetCommon):

    def test_matching_batch_payment(self):
        payment_method_line = self.company_data['default_journal_bank'].inbound_payment_method_line_ids\
            .filtered(lambda l: l.code == 'batch_payment')
        payment_method_line.payment_account_id = self.inbound_payment_method_line.payment_account_id

        payment = self.env['account.payment'].create({
            'payment_type': 'inbound',
            'partner_type': 'customer',
            'partner_id': self.partner_a.id,
            'payment_method_line_id': payment_method_line.id,
            'amount': 100.0,
        })
        payment.action_post()

        batch = self.env['account.batch.payment'].create({
            'journal_id': self.company_data['default_journal_bank'].id,
            'payment_ids': [Command.set(payment.ids)],
            'payment_method_id': payment_method_line.payment_method_id.id,
        })
        self.assertRecordValues(batch, [{'state': 'draft'}])

        # Validate the batch and print it.
        batch.validate_batch()
        batch.print_batch_payment()
        self.assertRecordValues(batch, [{'state': 'sent'}])

        st_line = self._create_st_line(1000.0, payment_ref=f"turlututu {batch.name} tsointsoin", partner_id=self.partner_a.id)

        # Create a rule matching the batch payment.
        self.env['account.reconcile.model'].search([('company_id', '=', self.company_data['company'].id)]).unlink()
        rule = self._create_reconcile_model()

        # Ensure the rule matched the batch.
        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        wizard._action_trigger_matching_rules()

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 1000.0,  'reconcile_model_id': False},
            {'flag': 'new_aml',         'balance': -100.0,  'reconcile_model_id': rule.id},
            {'flag': 'auto_balance',    'balance': -900.0,  'reconcile_model_id': False},
        ])
        self.assertRecordValues(wizard, [{
            'selected_batch_payment_ids': batch.ids,
            'state': 'valid',
        }])
        wizard._action_validate()

        self.assertRecordValues(batch, [{'state': 'reconciled'}])

    def test_batch_payment_selection_on_bank_reco_widget(self):
        payment_method_line = self.company_data['default_journal_bank'].inbound_payment_method_line_ids\
            .filtered(lambda l: l.code == 'batch_payment')
        payment_method_line.payment_account_id = self.inbound_payment_method_line.payment_account_id

        payments = self.env['account.payment'].create([
            {
                'payment_type': 'inbound',
                'partner_type': 'customer',
                'partner_id': self.partner_a.id,
                'payment_method_line_id': payment_method_line.id,
                'amount': i * 100.0,
            }
            for i in range(1, 5)
        ])
        payments.action_post()

        batch = self.env['account.batch.payment'].create({
            'journal_id': self.company_data['default_journal_bank'].id,
            'payment_ids': [Command.set(payments.ids)],
            'payment_method_id': payment_method_line.payment_method_id.id,
        })

        self.env.flush_all()

        # Mount the batch as new_amls (expanded) inside the bank reconciliation widget.
        st_line = self._create_st_line(1000.0)
        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        wizard._action_add_new_batch_payments(batch, expand=True)

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 1000.0,  'source_batch_payment_id': False},
            {'flag': 'new_aml',         'balance': -100.0,  'source_batch_payment_id': batch.id},
            {'flag': 'new_aml',         'balance': -200.0,  'source_batch_payment_id': batch.id},
            {'flag': 'new_aml',         'balance': -300.0,  'source_batch_payment_id': batch.id},
            {'flag': 'new_aml',         'balance': -400.0,  'source_batch_payment_id': batch.id},
        ])
        self.assertRecordValues(wizard, [{'selected_batch_payment_ids': batch.ids}])

        # Remove the batch
        wizard._action_remove_new_batch_payments(batch)

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 1000.0,  'source_batch_payment_id': False},
            {'flag': 'auto_balance',    'balance': -1000.0, 'source_batch_payment_id': False},
        ])
        self.assertRecordValues(wizard, [{'selected_batch_payment_ids': []}])

        # Mount the batch as normal inside the bank reconciliation widget.
        st_line = self._create_st_line(1000.0)
        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        wizard._action_add_new_batch_payments(batch)

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 1000.0,  'source_batch_payment_id': False},
            {'flag': 'new_batch',       'balance': -1000.0, 'source_batch_payment_id': batch.id},
        ])
        self.assertRecordValues(wizard, [{'selected_batch_payment_ids': batch.ids}])

        # Remove payment3 from the amls tab.
        aml_payment3 = payments[2].move_id.line_ids.filtered(lambda x: x.account_id.account_type not in ('asset_receivable', 'liability_payable', 'asset_cash', 'liability_credit_card'))
        wizard._action_remove_new_amls(aml_payment3)

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 1000.0,  'source_batch_payment_id': False},
            {'flag': 'new_aml',         'balance': -100.0,  'source_batch_payment_id': batch.id},
            {'flag': 'new_aml',         'balance': -200.0,  'source_batch_payment_id': batch.id},
            {'flag': 'new_aml',         'balance': -400.0,  'source_batch_payment_id': batch.id},
            {'flag': 'auto_balance',    'balance': -300.0,  'source_batch_payment_id': False},
        ])
        self.assertRecordValues(wizard, [{'selected_batch_payment_ids': []}])

        # Add again payment3 from the aml tab.
        wizard._action_add_new_amls(aml_payment3)

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 1000.0,  'source_batch_payment_id': False},
            {'flag': 'new_aml',         'balance': -100.0,  'source_batch_payment_id': batch.id},
            {'flag': 'new_aml',         'balance': -200.0,  'source_batch_payment_id': batch.id},
            {'flag': 'new_aml',         'balance': -400.0,  'source_batch_payment_id': batch.id},
            {'flag': 'new_aml',         'balance': -300.0,  'source_batch_payment_id': batch.id},
        ])
        self.assertRecordValues(wizard, [{'selected_batch_payment_ids': batch.ids}])

        # Remove payment4 & add it again using the batch.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'new_aml' and x.balance == -400.0)
        wizard._action_remove_lines(line)
        wizard._action_add_new_batch_payments(batch, expand=True)

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 1000.0,  'source_batch_payment_id': False},
            {'flag': 'new_aml',         'balance': -100.0,  'source_batch_payment_id': batch.id},
            {'flag': 'new_aml',         'balance': -200.0,  'source_batch_payment_id': batch.id},
            {'flag': 'new_aml',         'balance': -300.0,  'source_batch_payment_id': batch.id},
            {'flag': 'new_aml',         'balance': -400.0,  'source_batch_payment_id': batch.id},
        ])
        self.assertRecordValues(wizard, [{'selected_batch_payment_ids': batch.ids}])

        # Remove payment4 & add its batch again as one batch line.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'new_aml' and x.balance == -400.0)
        wizard._action_remove_lines(line)
        wizard._action_add_new_batch_payments(batch)

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 1000.0,  'source_batch_payment_id': False},
            {'flag': 'new_batch',       'balance': -1000.0, 'source_batch_payment_id': batch.id},
        ])
        self.assertRecordValues(wizard, [{'selected_batch_payment_ids': batch.ids}])

    def test_batch_payment_rejection_on_bank_reco_widget(self):
        payment_method_line = self.company_data['default_journal_bank'].inbound_payment_method_line_ids\
            .filtered(lambda l: l.code == 'batch_payment')
        payment_method_line.payment_account_id = self.inbound_payment_method_line.payment_account_id

        payments = self.env['account.payment'].create([
            {
                'date': '2018-01-01',
                'payment_type': 'inbound',
                'partner_type': 'customer',
                'partner_id': self.partner_a.id,
                'payment_method_line_id': payment_method_line.id,
                'amount': i * 100.0,
            }
            for i in range(1, 4)
        ])
        payments.action_post()

        batch = self.env['account.batch.payment'].create({
            'journal_id': self.company_data['default_journal_bank'].id,
            'payment_ids': [Command.set(payments.ids)],
            'payment_method_id': payment_method_line.payment_method_id.id,
        })
        batch.validate_batch()

        # Mount the batch inside the bank reconciliation widget.
        st_line = self._create_st_line(300.0, partner_id=self.partner_a.id)
        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        wizard._action_add_new_batch_payments(batch)

        # Validate with the full batch should reconcile directly the statement line.
        wizard._js_action_validate()
        self.assertTrue(wizard.return_todo_command)
        self.assertTrue(wizard.return_todo_command.get('done'))
        wizard._js_action_reset()

        self.skipTest("Need to take better care of batch payments without entries")  # TODO WAN
        # Remove a payment and check the wizard is well opened.
        wizard._action_add_new_batch_payments(batch, expand=True)
        line = wizard.line_ids.filtered(lambda x: x.flag == 'new_aml' and x.source_aml_id.payment_id == payments[-1])
        wizard._action_remove_lines(line)
        wizard._js_action_validate()
        self.assertTrue(wizard.return_todo_command)
        self.assertEqual(
            wizard.return_todo_command.get('open_batch_rejection_wizard', {}).get('res_model'),
            'account.batch.payment.rejection',
        )

        # Create the rejection wizard.
        rejection_wizard = self.env['account.batch.payment.rejection']\
            .with_context(**wizard.return_todo_command['open_batch_rejection_wizard']['context'])\
            .create({})
        self.assertRecordValues(rejection_wizard, [{
            'in_reconcile_payment_ids': payments[:-1].ids,
            'rejected_payment_ids': payments[-1].ids,
            'nb_rejected_payment_ids': 1,
            'nb_batch_payment_ids': 1,
        }])

        # Chose to cancel the payments with a lock date.
        self.env.company.fiscalyear_lock_date = '2018-01-01'
        rejection_wizard.button_cancel_payments()
        self.assertEqual(len(batch.payment_ids), len(payments) - 1, "The last payment has been removed from the batch")
        self.assertRecordValues(payments[-1].move_id.line_ids, [{'reconciled': True}] * 2)

        # Chose to cancel the payments without a lock date.
        self.env.company.fiscalyear_lock_date = None
        rejection_wizard.rejected_payment_ids.move_id.line_ids.remove_move_reconcile()
        rejection_wizard.rejected_payment_ids.batch_payment_id = batch
        rejection_wizard.button_cancel_payments()
        self.assertFalse(rejection_wizard.rejected_payment_ids.exists())

    def test_single_payment_from_batch_on_bank_reco_widget(self):
        payment_method_line = self.company_data['default_journal_bank'].inbound_payment_method_line_ids\
            .filtered(lambda l: l.code == 'batch_payment')
        payment_method_line.payment_account_id = self.inbound_payment_method_line.payment_account_id

        payments = self.env['account.payment'].create([
            {
                'date': '2018-01-01',
                'payment_type': 'inbound',
                'partner_type': 'customer',
                'partner_id': self.partner_a.id,
                'payment_method_line_id': payment_method_line.id,
                'amount': i * 100.0,
            }
            for i in range(1, 4)
        ])
        payments.action_post()

        # Add payments to a batch.
        batch_payment = self.env['account.batch.payment'].create({
            'journal_id': self.company_data['default_journal_bank'].id,
            'payment_ids': [Command.set(payments.ids)],
            'payment_method_id': payment_method_line.payment_method_id.id,
        })

        st_line = self._create_st_line(100.0, partner_id=self.partner_a.id)
        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        # Add payment1 from the aml tab
        aml = payments[0].move_id.line_ids.filtered(lambda x: x.account_id.account_type != 'asset_receivable')
        wizard._action_add_new_amls(aml)

        # Validate with one payment inside a batch should reconcile directly the statement line.
        wizard._js_action_validate()
        self.assertTrue(wizard.return_todo_command)
        self.assertTrue(wizard.return_todo_command.get('done'))

        self.assertEqual(batch_payment.amount_residual, sum(payments[1:].mapped('amount')), "The batch amount should change following payment reconciliation")

    def test_multiple_exchange_diffs_in_batch(self):
        payment_method_line = self.company_data['default_journal_bank'].inbound_payment_method_line_ids\
            .filtered(lambda l: l.code == 'batch_payment')
        payment_method_line.payment_account_id = self.inbound_payment_method_line.payment_account_id
        # Create a statement line when the currency rate is 1 USD == 2 EUR == 4 CAD
        st_line = self._create_st_line(
            1000.0,
            partner_id=self.partner_a.id,
            date='2017-01-01'
        )
        inv_line = self._create_invoice_line(
            'out_invoice',
            partner_id=self.partner_a.id,
            invoice_line_ids=[{'price_unit': 5000.0, 'tax_ids': []}],
        )
        # Payment when 1 USD == 1 EUR
        payment_eur_gain_diff = self.env['account.payment'].create({
            'date': '2015-01-01',
            'payment_type': 'inbound',
            'partner_type': 'customer',
            'partner_id': self.partner_a.id,
            'payment_method_line_id': payment_method_line.id,
            'currency_id': self.other_currency.id,
            'amount': 100.0,
        })
        # Payment when 1 USD == 1 EUR
        payment_eur_gain_diff_2 = self.env['account.payment'].create({
            'date': '2015-01-01',
            'payment_type': 'inbound',
            'partner_type': 'customer',
            'partner_id': self.partner_a.id,
            'payment_method_line_id': payment_method_line.id,
            'currency_id': self.other_currency.id,
            'amount': 200.0,
        })
        # Payment when 1 USD == 3 EUR
        payment_eur_loss_diff = self.env['account.payment'].create({
            'date': '2016-01-01',
            'payment_type': 'inbound',
            'partner_type': 'customer',
            'partner_id': self.partner_a.id,
            'payment_method_line_id': payment_method_line.id,
            'currency_id': self.other_currency.id,
            'amount': 240.0,
        })
        # Payment when 1 USD == 6 CAD
        payment_cad_loss_diff = self.env['account.payment'].create({
            'date': '2016-01-01',
            'payment_type': 'inbound',
            'partner_type': 'customer',
            'partner_id': self.partner_a.id,
            'payment_method_line_id': payment_method_line.id,
            'currency_id': self.other_currency_2.id,
            'amount': 300.0,
        })
        payments = payment_eur_gain_diff + payment_eur_gain_diff_2 + payment_eur_loss_diff + payment_cad_loss_diff
        payments.action_post()
        batch = self.env['account.batch.payment'].create({
            'journal_id': self.company_data['default_journal_bank'].id,
            'payment_ids': [Command.set(payments.ids)],
            'payment_method_id': payment_method_line.payment_method_id.id,
        })

        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        wizard._action_add_new_amls(inv_line)
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 1000.0},
            {'flag': 'new_aml',         'balance': -1000.0},
        ])

        wizard._action_add_new_batch_payments(batch)
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'amount_currency': 1000.0,     'balance': 1000.0},
            {'flag': 'new_aml',         'amount_currency': -655.0,     'balance': -655.0},
            {'flag': 'new_batch',       'amount_currency': -840.0,     'balance': -430.0},
            {'flag': 'exchange_diff',   'amount_currency': 0.0,        'balance': 150},
            {'flag': 'exchange_diff',   'amount_currency': 0.0,        'balance': -40.0},
            {'flag': 'exchange_diff',   'amount_currency': 0.0,        'balance': -25.0},
        ])

        wizard._action_expand_batch_payments(batch)
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'amount_currency': 1000.0,     'balance': 1000.0},
            {'flag': 'new_aml',         'amount_currency': -655.0,     'balance': -655.0},
            {'flag': 'new_aml',         'amount_currency': -100.0,     'balance': -100.0},
            {'flag': 'exchange_diff',   'amount_currency': 0.0,        'balance': 50.0},
            {'flag': 'new_aml',         'amount_currency': -200.0,     'balance': -200.0},
            {'flag': 'exchange_diff',   'amount_currency': 0.0,        'balance': 100.0},
            {'flag': 'new_aml',         'amount_currency': -240.0,     'balance': -80.0},
            {'flag': 'exchange_diff',   'amount_currency': 0.0,        'balance': -40.0},
            {'flag': 'new_aml',         'amount_currency': -300.0,     'balance': -50.0},
            {'flag': 'exchange_diff',   'amount_currency': 0.0,        'balance': -25.0},
        ])
