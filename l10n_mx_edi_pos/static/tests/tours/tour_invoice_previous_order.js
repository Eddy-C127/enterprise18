/** @odoo-module **/
import tour from 'web_tour.tour';
tour.register('l10n_mx_edi_pos.tour_invoice_previous_order', {
    test: true,
}, [
    {
        content: "Click the POS icon",
        trigger: ".o_app[data-menu-xmlid='point_of_sale.menu_point_root']",
    },
    {
        content: "Open POS session from backend",
        trigger: "button[name='open_ui']",
    },
    {
        content: "Open POS session popup",
        trigger: "div.button:contains('Open session')",
    },
    {
        content: "Select a product",
        trigger: "div:contains('Acoustic Bloc Screens')",
    },
    {
        content: "go to Payment",
        trigger: ".pay-circle",
    },
    {
        content: "Select payment method",
        trigger: "div.button.paymentmethod",
    },
    {
        content: "Validate",
        trigger: "div.button.next.validation",
    },
    {
        content: "click on New Order",
        trigger: "div.button:contains('New Order')",
    },
    {
        content: "Check the previous Order",
        trigger: "div.ticket-button:contains('Orders')",
    },
    {
        content: "Select dropdown",
        trigger: "div.filter",
    },
    {
        content: "Select 'Paid Orders'",
        trigger: "li:contains('Paid')",
    },
    {
        content: "Pick the first order in the list",
        trigger: "div.order-row:contains('Paid'):first",
    },
    {
        content: "Ask an invoice for this order",
        trigger: "div.control-button:contains('Invoice')",
    },
    {
        content: "Do you want to select a customer ? Yes",
        trigger: "div.button.confirm:contains('Ok')",
    },
    {
        content: "Select first partner in the list",
        trigger: "tr.partner-line:first",
    },
    {
        content: "Set Usage: 'General Expenses'",
        trigger: "select[name='l10n_mx_edi_usage']",
        run: 'text G03',
    },
    {
        content: "Set Invoice to Public: 'Yes'",
        trigger: "select[name='l10n_mx_edi_cfdi_to_public']",
        run: 'text 1',
    },
    {
        content: "Confirm and close the popup",
        trigger: ".button.confirm",
    },
]);
