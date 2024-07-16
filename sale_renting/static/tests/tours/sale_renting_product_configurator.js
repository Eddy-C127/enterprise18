/** @odoo-module **/

import { registry } from '@web/core/registry';
import { stepUtils } from '@web_tour/tour_service/tour_utils';
import configuratorTourUtils from '@sale/js/tours/product_configurator_tour_utils';
import tourUtils from '@sale/js/tours/tour_utils';

registry
    .category('web_tour.tours')
    .add('sale_renting_product_configurator', {
        test: true,
        url: '/web',
        steps: () => [
            stepUtils.showAppsMenuItem(),
            {
                content: "Open the rental app",
                trigger: '.o_app[data-menu-xmlid="sale_renting.rental_menu_root"]',
                run: 'click',
            },
            {
                content: "Create a new SO",
                trigger: '.o-kanban-button-new',
                run: 'click',
            },
            ...tourUtils.selectCustomer("Customer"),
            ...tourUtils.addProduct("Main product"),
            // Assert that the rental prices and durations are correct.
            configuratorTourUtils.assertProductPrice("Main product", '15.00'),
            configuratorTourUtils.assertProductPriceInfo("Main product", "1 Day"),
            configuratorTourUtils.assertOptionalProductPrice("Optional product", '16.00'),
            configuratorTourUtils.assertOptionalProductPriceInfo("Optional product", "1 Day"),
            {
                content: "Confirm the configurator",
                trigger: ".modal button:contains(Confirm)",
                in_modal: false,
                run: 'click',
            },
            {
                trigger: "body:not(:has(.modal))",
            },
            // Don't end the tour with a form in edition mode.
            ...tourUtils.saveForm(),
        ],
   });
