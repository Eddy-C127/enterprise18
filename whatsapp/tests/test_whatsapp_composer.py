# Part of Odoo. See LICENSE file for full copyright and licensing details.

from freezegun import freeze_time

from odoo import exceptions
from odoo.addons.base.tests.test_ir_cron import CronMixinCase
from odoo.addons.whatsapp.tests.common import WhatsAppCommon
from odoo.fields import Datetime
from odoo.tests import tagged, users


class WhatsAppComposerCase(WhatsAppCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # WRITE access on partner is required to be able to post a message on it
        cls.user_employee.write({'groups_id': [(4, cls.env.ref('base.group_partner_manager').id)]})

        # test records for sending messages
        cls.customers = cls.env['res.partner'].create([
            {
                'country_id': cls.env.ref('base.in').id,
                'name': 'Customer-IN',
                'mobile': "+91 12345 67891",
            }, {
                'country_id': cls.env.ref('base.be').id,
                'name': 'Customer-BE',
                'mobile': "0456001122",
            }
        ])

        # templates (considered as approved)
        cls.template_basic, cls.template_dynamic_cplx = cls.env['whatsapp.template'].create([
            {
                'body': 'Hello World',
                'name': 'Test-basic',
                'status': 'approved',
                'wa_account_id': cls.whatsapp_account.id,
            }, {
                'body': '''Hello I am {{1}},
Here my mobile number: {{2}},
You are coming from {{3}}.
Welcome to {{4}} office''',
                'name': 'Test-dynamic-complex',
                'status': 'approved',
                'variable_ids': [
                    (5, 0, 0),
                    (0, 0, {'name': "{{1}}", 'line_type': "body", 'field_type': "user_name", 'demo_value': "Jigar"}),
                    (0, 0, {'name': "{{2}}", 'line_type': "body", 'field_type': "user_mobile", 'demo_value': "+91 12345 12345"}),
                    (0, 0, {'name': "{{3}}", 'line_type': "body", 'field_type': "field", 'demo_value': "sample country", 'field_name': 'country_id.name'}),
                    (0, 0, {'name': "{{4}}", 'line_type': "body", 'field_type': "free_text", 'demo_value': "Odoo In"}),
                ],
                'wa_account_id': cls.whatsapp_account.id,
            }
        ])


@tagged('wa_composer')
class WhatsAppComposerInternals(WhatsAppComposerCase, CronMixinCase):

    def test_assert_initial_data(self):
        """ Ensure base data for tests, to ease understanding them """
        self.assertEqual(self.company_admin.country_id, self.env.ref('base.us'))
        self.assertEqual(self.user_admin.country_id, self.env.ref('base.be'))

    @users('employee')
    def test_composer_check_user_number(self):
        """ When using 'user_mobile' in template variables, number should be
        set on sender. """
        template = self.template_dynamic_cplx.with_user(self.env.user)

        for mobile, should_crash in [
            (False, True),
            ('', True),
            ('zboing', False)
        ]:
            with self.subTest(mobile=mobile):
                self.env.user.mobile = mobile

                composer_form = self._wa_composer_form(template, self.customers[0])
                composer = composer_form.save()
                if should_crash:
                    with self.assertRaises(exceptions.ValidationError), self.mockWhatsappGateway():
                        composer.action_send_whatsapp_template()
                else:
                    with self.mockWhatsappGateway():
                        composer.action_send_whatsapp_template()

    @users('employee')
    def test_composer_number_validation(self):
        """ Test number computation and validation in single / batch mode. Also
        test direct send by cron / delegate behavior. """
        template = self.template_basic.with_env(self.env)
        date_reference = Datetime.from_string('2023-11-22 09:00:00')
        invalid_customer = self.env['res.partner'].sudo().create({
            'country_id': self.env.ref('base.in').id,
            'mobile': "12321",
            'name': 'Customer-IN',
        })
        all_test_records = invalid_customer + self.customers

        for test_records, force_cron, exp_crash, exp_batch, exp_cron_trigger in [
            (all_test_records[0], False, True, False, False),  # no need to force cron in single mode
            (all_test_records, False, False, True, True),  # batch mode always force cron
            (all_test_records, True, False, True, True),
        ]:
            with self.subTest(test_records=test_records, force_cron=force_cron):
                test_records = test_records.with_env(self.env)
                composer_form = self._wa_composer_form(template, from_records=test_records)
                self.assertEqual(composer_form.batch_mode, exp_batch)
                self.assertEqual(composer_form.invalid_phone_number_count, 0)
                composer = composer_form.save()

                # Test that the WhatsApp composer fails validation when there is invalid number.
                with freeze_time(date_reference), \
                     self.capture_triggers('whatsapp.ir_cron_send_whatsapp_queue') as captured_triggers, \
                     self.mockWhatsappGateway():
                    if exp_crash:
                        with self.assertRaises(exceptions.UserError):
                            composer._send_whatsapp_template(force_send_by_cron=force_cron)
                    else:
                        composer._send_whatsapp_template(force_send_by_cron=force_cron)

                # in batch mode: two messages ready to be sent (invalid is ignored)
                if exp_batch:
                    self.assertEqual(len(self._new_wa_msg), 2)
                    for exp_contacted in self.customers:
                        self.assertWAMessageFromRecord(
                            exp_contacted,
                            status="outgoing",
                        )
                if exp_cron_trigger:
                    self.assertEqual(len(captured_triggers.records), 1)
                    self.assertEqual(
                        captured_triggers.records[0].cron_id,
                        self.env.ref('whatsapp.ir_cron_send_whatsapp_queue'))
                    self.assertEqual(captured_triggers.records[0].call_at, date_reference)
                else:
                    self.assertFalse(captured_triggers.records)

    @users('employee')
    def test_composer_tpl_button(self):
        """ Test adding buttons on templates """
        for button_values in [
            {'button_type': 'quick_reply'},
            {'button_type': 'phone_number', 'call_number': '+91 (835) 902-5723'},
            {'button_type': 'url', 'website_url': 'https://www.odoo.com'},
        ]:
            with self.subTest(button_values=button_values):
                self.template_basic.write({'button_ids': [(5, 0)]})
                self._add_button_to_template(self.template_basic, f"Test {button_values['button_type']}", **button_values)

                template = self.template_basic.with_env(self.env)
                composer = self._instanciate_wa_composer_from_records(template, from_records=self.customers[0])
                with self.mockWhatsappGateway():
                    composer.action_send_whatsapp_template()

                self.assertWAMessage()


@tagged('wa_composer')
class WhatsAppComposerPreview(WhatsAppComposerCase):

    @users('user_wa_admin')
    def test_composer_preview(self):
        """ Test preview feature from composer """
        template = self.env['whatsapp.template'].create({
            'body': 'feel free to contact {{1}}',
            'footer_text': 'Thanks you',
            'header_text': 'Header {{1}}',
            'header_type': 'text',
            'variable_ids': [
                (5, 0, 0),
                (0, 0, {
                'name': "{{1}}",
                'line_type': 'body',
                'field_type': "free_text",
                'demo_value': "Nishant",
                }),
                (0, 0, {
                'name': "{{1}}",
                'line_type': 'header',
                'field_type': "free_text",
                'demo_value': "Jigar",
                }),
            ],
            'wa_account_id': self.whatsapp_account.id,
        })
        composer = self._instanciate_wa_composer_from_records(template, from_records=self.customers[0])
        for expected_var in ['Nishant', 'Jigar']:
            self.assertIn(expected_var, composer.preview_whatsapp)
