/** @odoo-module **/

import { registry } from "@web/core/registry";

// This tour relies on data created on the Python test.
registry.category("web_tour.tours").add("sale_external_optional_products", {
    url: "/my/quotes",
    steps: () => [
        {
            content: "open the test SO",
            trigger: 'a:contains("test")',
            run: "click",
        },
        {
            trigger: ".o_portal_sidebar_content h2:contains($):contains(10.00)",
        },
        {
            trigger: 'li a:contains("Communication history")', // Element on the left
        },
        {
            content: "add the optional product",
            trigger: ".js_add_optional_products:contains(add to order)",
            run: "click",
        },
        {
            trigger: ".o_portal_sidebar_content h2:contains($):contains(11.15)",
        },
        {
            content: "increase the quantity of the optional product by 1",
            trigger: ".js_update_line_json[title='Add one']",
            run: "click",
        },
        {
            content: "wait for the quantity to be updated",
            trigger: "input.js_quantity:value(2.0)",
        },
        {
            trigger: ".o_portal_sidebar_content h2:contains($):contains(12.30)",
        },
        {
            content: "delete the optional line",
            trigger: "table#sales_order_table tbody tr:eq(1) a[title=Remove]",
            run: "click",
        },
        {
            trigger: ".o_portal_sidebar_content h2:contains($):contains(10.00)",
        },
        {
            content: "wait for line to be deleted and show up again in optional products",
            trigger: ".js_add_optional_products",
        },
    ],
});
