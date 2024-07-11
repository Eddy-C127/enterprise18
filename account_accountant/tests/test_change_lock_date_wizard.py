from odoo import fields
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.addons.account_accountant.wizard.account_change_lock_date import SOFT_LOCK_DATE_FIELDS
from odoo.exceptions import UserError
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestChangeLockDateWizard(AccountTestInvoicingCommon):

    def test_exception_generation(self):
        """
        Test the exception generation from the wizard.
        Note that exceptions for 'everyone' and 'forever' are not tested here.
        They do not create an exception (no 'account.lock_exception' object), but just change the lock date.
        (See `test_everyone_forever_exception`.)
        """
        self.env['account.lock_exception'].search([]).sudo().unlink()

        for lock_date_field in SOFT_LOCK_DATE_FIELDS:
            with self.subTest(lock_date_field=lock_date_field), self.cr.savepoint() as sp:
                # We can set the lock date if there is none.
                self.env['account.change.lock.date'].create({lock_date_field: '2010-01-01'}).change_lock_date()
                self.assertEqual(self.env.company[lock_date_field], fields.Date.from_string('2010-01-01'))

                # We can increase the lock date if there is one.
                self.env['account.change.lock.date'].create({lock_date_field: '2011-01-01'}).change_lock_date()
                self.assertEqual(self.env.company[lock_date_field], fields.Date.from_string('2011-01-01'))

                # We cannot remove the lock date; not even with an exception.
                wizard = self.env['account.change.lock.date'].create({
                    lock_date_field: False,
                    'exception_applies_to': 'everyone',
                    'exception_duration': '1h',
                    'exception_reason': ':TestChangeLockDateWizard.test_exception_generation; remove',
                })
                with self.assertRaises(UserError), self.env.cr.savepoint():
                    wizard.change_lock_date()

                # Ensure we have not created any exceptions yet
                self.assertEqual(self.env['account.lock_exception'].search_count([]), 0)

                # We cannot decrease the lock date; but we can create an exception
                self.env['account.change.lock.date'].create({lock_date_field: '2009-01-01'}).change_lock_date()
                self.assertEqual(self.env.company[lock_date_field], fields.Date.from_string('2011-01-01'))
                exception = self.env['account.lock_exception'].search([])
                self.assertEqual(len(exception), 1)
                # Check lock date and default values on exception
                self.assertRecordValues(exception, [{
                    lock_date_field: fields.Date.from_string('2009-01-01'),
                    'company_id': self.env.company.id,
                    'user_id': self.env.user.id,
                    'create_uid': self.env.user.id,
                    'end_datetime': False,
                    'reason': False,
                }])

                sp.close()  # Rollback to ensure all subtests start in the same situation

    def test_hard_lock_date(self):
        self.env['account.lock_exception'].search([]).sudo().unlink()

        # We can set the hard lock date if there is none.
        self.env['account.change.lock.date'].create({'hard_lock_date': '2010-01-01'}).change_lock_date()
        self.assertEqual(self.env.company.hard_lock_date, fields.Date.from_string('2010-01-01'))

        # We can increase the hard lock date if there is one.
        self.env['account.change.lock.date'].create({'hard_lock_date': '2011-01-01'}).change_lock_date()
        self.assertEqual(self.env.company.hard_lock_date, fields.Date.from_string('2011-01-01'))

        # We cannot decrease the hard lock date; not even with an exception.
        wizard = self.env['account.change.lock.date'].create({
            'hard_lock_date': '2009-01-01',
            'exception_applies_to': 'everyone',
            'exception_duration': '1h',
            'exception_reason': ':TestChangeLockDateWizard.test_hard_lock_date',
        })
        with self.assertRaises(UserError), self.env.cr.savepoint():
            wizard.change_lock_date()
        self.assertEqual(self.env.company.hard_lock_date, fields.Date.from_string('2011-01-01'))

        # We cannot remove the hard lock date; not even with an exception.
        wizard = self.env['account.change.lock.date'].create({
            'hard_lock_date': False,
            'exception_applies_to': 'everyone',
            'exception_duration': '1h',
            'exception_reason': ':TestChangeLockDateWizard.test_hard_lock_date',
        })
        with self.assertRaises(UserError), self.env.cr.savepoint():
            wizard.change_lock_date()
        self.assertEqual(self.env.company.hard_lock_date, fields.Date.from_string('2011-01-01'))

        self.assertEqual(self.env['account.lock_exception'].search_count([]), 0)

    def test_everyone_forever_exception(self):
        self.env['account.lock_exception'].search([]).sudo().unlink()

        for lock_date_field in SOFT_LOCK_DATE_FIELDS:
            with self.subTest(lock_date_field=lock_date_field), self.cr.savepoint() as sp:
                self.env['account.change.lock.date'].create({lock_date_field: '2010-01-01'}).change_lock_date()
                self.assertEqual(self.env.company[lock_date_field], fields.Date.from_string('2010-01-01'))

                # We can decrease the lock date with a 'forever' / 'everyone' exception.
                self.env['account.change.lock.date'].create({
                    lock_date_field: '2009-01-01',
                    'exception_applies_to': 'everyone',
                    'exception_duration': 'forever',
                    'exception_reason': ':TestChangeLockDateWizard.test_everyone_forever_exception; remove',
                }).change_lock_date()
                self.assertEqual(self.env.company[lock_date_field], fields.Date.from_string('2009-01-01'))

                # We can remove the lock date with a 'forever' / 'everyone' exception.
                self.env['account.change.lock.date'].create({
                    lock_date_field: False,
                    'exception_applies_to': 'everyone',
                    'exception_duration': 'forever',
                    'exception_reason': ':TestChangeLockDateWizard.test_everyone_forever_exception; remove',
                }).change_lock_date()
                self.assertEqual(self.env.company[lock_date_field], False)

                # Ensure we have not created any exceptions
                self.assertEqual(self.env['account.lock_exception'].search_count([]), 0)

                sp.close()  # Rollback to ensure all subtests start in the same situation
