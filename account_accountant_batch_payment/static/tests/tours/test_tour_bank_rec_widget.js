/** @odoo-module **/

import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/tour_service/tour_utils";
import { accountTourSteps } from "@account/js/tours/account";

registry.category("web_tour.tours").add("account_accountant_batch_payment_bank_rec_widget", {
    test: true,
    url: "/odoo",
    steps: () => [
        stepUtils.showAppsMenuItem(),
        ...accountTourSteps.goToAccountMenu("Open the accounting module"),

        // Open the widget. The first line should be selected by default.
        {
            trigger: ".o_breadcrumb",
        },
        {
            content: "Open the bank reconciliation widget",
            trigger: "button.btn-secondary[name='action_open_reconcile']",
            run: "click",
        },
        {
            content: "The 'line1' should be selected by default",
            trigger: "div[name='line_ids'] td[field='name']:contains('line1')",
        },

        // Mount the batch payment and remove one payment.
        {
            content: "Click on the 'batch_payments_tab'",
            trigger: "a[name='batch_payments_tab']",
            run: "click",
        },
        {
            content: "Mount BATCH0001",
            trigger:
                "div.bank_rec_widget_form_batch_payments_list_anchor table.o_list_table td[name='name']:contains('BATCH0001')",
            run: "click",
        },
        {
            content: "The batch should be selected",
            trigger:
                "div.bank_rec_widget_form_batch_payments_list_anchor table.o_list_table tr.o_rec_widget_list_selected_item",
        },
        {
            content: "Expand the added batch line",
            trigger: "div[name='line_ids'] .fa-caret-right",
            run: "click",
        },
        {
            content: "The batch should still be selected",
            trigger:
                "div.bank_rec_widget_form_batch_payments_list_anchor table.o_list_table tr.o_rec_widget_list_selected_item",
        },
        {
            trigger: "td[field='account_id']:contains('Outstanding Receipts')",
        },
        {
            content: "Remove the payment of 100.0",
            trigger: "div[name='line_ids'] .fa-trash-o:last",
            run: "click",
        },

        // Check the batch rejection wizard.
        {
            trigger: "button.btn-primary:contains('Validate')",
        },
        {
            content: "Validate and open the wizard",
            trigger: "button:contains('Validate')",
            run: "click",
        },
        {
            trigger: "div.modal-content",
        },
        {
            content: "Click on 'Cancel'",
            trigger: "div.modal-content button[name='button_cancel']",
            run: "click",
        },
        {
            trigger: "body:not(.modal-open)",
        },
        {
            content: "Validate and open the wizard",
            trigger: "button:contains('Validate')",
            run: "click",
        },
        {
            trigger: "div.modal-content",
        },
        {
            content: "Click on 'Expect Payments Later'",
            trigger: "div.modal-content button[name='button_continue']",
            run: "click",
        },

        // Reconcile 'line2' with the remaining payment in batch.
        {
            trigger: "div[name='line_ids'] td[field='name']:contains('line2')",
        },
        {
            content: "The 'line2' should be selected by default",
            trigger: "div[name='line_ids'] td[field='name']:contains('line2')",
        },
        {
            content: "Click on the 'batch_payments_tab'",
            trigger: "a[name='batch_payments_tab']",
            run: "click",
        },
        {
            content: "Mount BATCH0001",
            trigger:
                "div.bank_rec_widget_form_batch_payments_list_anchor table.o_list_table td[name='name']:contains('BATCH0001')",
            run: "click",
        },
        {
            content: "Expand the added batch line",
            trigger: "div[name='line_ids'] .fa-caret-right",
            run: "click",
        },
        {
            content: "One payment should be displayed",
            trigger: "td[field='account_id']:contains('Outstanding Receipts')",
        },
        {
            trigger: "button.btn-primary:contains('Validate')",
        },
        {
            content: "Validate. The wizard should be opened.",
            trigger: "button:contains('Validate')",
            run: "click",
        },
        {
            trigger: "div[name='line_ids'] td[field='name']:contains('line3')",
        },
        {
            content: "The 'line3' should be selected by default",
            trigger: "div[name='line_ids'] td[field='name']:contains('line3')",
        },
        ...stepUtils.toggleHomeMenu(),
        ...accountTourSteps.goToAccountMenu("Reset back to accounting module"),
        {
            content: "check that we're back on the dashboard",
            trigger: 'a:contains("Customer Invoices")',
        },
    ],
});
