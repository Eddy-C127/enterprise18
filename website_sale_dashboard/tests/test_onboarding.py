# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.onboarding.tests.case import TransactionCaseOnboarding


class TestOnboarding(TransactionCaseOnboarding):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.account_payment_provider_step = cls.env.ref(
            "account_payment.onboarding_onboarding_step_payment_provider"
        )
        cls.website_sale_dashboard_payment_provider_step = cls.env.ref(
            "website_sale_dashboard.onboarding_onboarding_step_payment_provider"
        )

    def test_payment_provider_website_sale_dashboard_validates_account(self):
        self.assert_step_is_not_done(self.website_sale_dashboard_payment_provider_step)
        self.assert_step_is_not_done(self.account_payment_provider_step)
        self.env["onboarding.onboarding.step"].action_validate_step_payment_provider()
        self.assert_step_is_done(self.website_sale_dashboard_payment_provider_step)
        self.assert_step_is_done(self.account_payment_provider_step)
