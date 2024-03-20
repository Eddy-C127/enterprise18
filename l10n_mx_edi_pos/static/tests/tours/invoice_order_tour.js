/** @odoo-module **/

import { registry } from "@web/core/registry";
import * as Dialog from "@point_of_sale/../tests/tours/utils/dialog_util";
import * as Chrome from "@point_of_sale/../tests/tours/utils/chrome_util";

registry.category("web_tour.tours").add("l10n_mx_edi_pos.tour_invoice_order", {
    test: true,
    steps: () => [
        {
            content: "Click the POS icon",
            trigger: ".o_app[data-menu-xmlid='point_of_sale.menu_point_root']",
        },
        {
            content: "Open POS session from backend",
            trigger: "button[name='open_ui']",
        },
        Dialog.confirm("Open session"),
        {
            content: "Select a product",
            trigger: "div.product-content:contains('product_mx')",
        },
        {
            content: "go to Payment",
            trigger: ".pay-order-button",
        },
        {
            content: "Customer wants an invoice",
            trigger: ".js_invoice",
        },
        {
            content: "Set Usage: 'General Expenses'",
            trigger: "select[name='l10n_mx_edi_usage']",
            run: "select G03",
        },
        {
            content: "Set Invoice to Public: 'Yes'",
            trigger: "select[name='l10n_mx_edi_cfdi_to_public']",
            run: "select 1",
        },
        Dialog.confirm(),
        Chrome.endTour(),
    ],
});
