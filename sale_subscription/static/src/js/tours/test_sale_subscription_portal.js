/** @odoo-module **/

import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add("test_sale_subscription_portal", {
    test: true,
    steps: () => [
        {
            content: "Check that Pay button is enabled",
            trigger: ".o_payment_form button[name='o_payment_submit_button']:not([disabled])",
        },
    ],
});

registry.category("web_tour.tours").add("test_sale_subscription_portal_payment", {
    test: true,
    steps: () => [
        {
            content: "Check that payment_message section is  not rendered",
            trigger: ":not(:contains(section#payment_message))",
        },
    ],
});
