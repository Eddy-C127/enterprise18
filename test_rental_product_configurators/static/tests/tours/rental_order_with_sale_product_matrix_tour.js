/** @odoo-module **/

import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

registry.category("web_tour.tours").add('rental_order_with_sale_product_matrix_tour', {
    url: '/web',
    test: true,
    steps: () => [stepUtils.showAppsMenuItem(), {
    trigger: '.o_app[data-menu-xmlid="sale_renting.rental_menu_root"]',
    edition: 'enterprise'
}, {
    trigger: '.o-kanban-button-new',
}, {
    trigger: '.o_required_modifier[name=partner_id] input',
    run: 'text Tajine Saucisse',
}, {
    trigger: '.ui-menu-item > a:contains("Tajine Saucisse")',
    auto: true,
},
// Adding a sale product without any configurator
{
    trigger: 'a:contains("Add a product")'
}, {
    trigger: 'div[name="product_template_id"] input',
    run: 'text protection',
}, {
    trigger: 'ul.ui-autocomplete a:contains("Chair floor protection (TEST)")',
},
// Adding a rental product
{
    trigger: 'a:contains("Add a product")',
    extra_trigger: 'td[name="product_template_id"][data-tooltip*="floor protection"],td[name="product_id"][data-tooltip*="floor protection"]',
}, {
    trigger: 'div[name="product_template_id"] input',
    run: 'text Projector',
}, {
    trigger: 'ul.ui-autocomplete a:contains("Projector (TEST)")',
},
// Adding a sale product with a matrix
{
    trigger: 'a:contains("Add a product")',
    extra_trigger: 'td[name="product_template_id"][data-tooltip*="Projector"],td[name="product_id"][data-tooltip*="Projector"]',
}, {
    trigger: 'div[name="product_template_id"] input',
    run: 'text Matrix',
}, {
    trigger: 'ul.ui-autocomplete a:contains("Matrix")',
}, {
    trigger: '.o_matrix_input_table',
    run: function () {
        [...document.querySelectorAll('.o_matrix_input')].slice(8, 16).forEach((el) => el.value = 4);
    } // set the qty to 4 for half of the matrix products.
}, {
    trigger: 'button:contains("Confirm")',
},
    ...stepUtils.saveForm({ extra_trigger: '.o_field_cell.o_data_cell.o_list_number:contains("26")' }),
]});
