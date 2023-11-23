/** @odoo-module **/
import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

const StepToFSMProductsKanbanWithFavoritesFilterSteps = [
    {
        content: 'Open FSM app.',
        trigger: '.o_app[data-menu-xmlid="industry_fsm.fsm_menu_root"]',
    },
    {
        content: 'Open All Tasks.',
        trigger: 'button[data-menu-xmlid="industry_fsm.fsm_menu_all_tasks_root"]',
    },
    {
        content: 'Open All Tasks.',
        trigger: 'a[data-menu-xmlid="industry_fsm.fsm_menu_all_tasks_todo"]',
    },
    {
        content: 'Open Task Form',
        trigger: ".o_data_row span:contains(Fsm task)",
    },
    {
        content: 'Open the Product Kanban View',
        trigger: 'button[name="action_fsm_view_material"]',
    }
];

const AddTrackingLineAndValidateSteps = [
    {
        content: 'Add a line in the wizard',
        trigger: 'div[name="tracking_line_ids"] a[role="button"]:contains(Add a line)',
        extra_trigger: 'div[role="dialog"]',
    },
    {
        content: 'Enter the lot number',
        trigger: 'div[name="tracking_line_ids"] tr.o_data_row.o_selected_row div[name="lot_id"] input[type="text"]',
        extra_trigger: 'div[role="dialog"]',
        run: 'text Lot_1',
    },
    {
        content: 'Select Lot_1',
        trigger: ".o-autocomplete--dropdown-menu li:contains(Lot_1)",
        auto: true,
        in_modal: false,
    },
    {
        content: 'Validate',
        trigger: 'button[name="generate_lot"]',
    },
];

/**
 * This tour depends on data created by python test in charge of launching it.
 * It is not intended to work when launched from interface.
 * The main purpose of this tour is:
 * - To check that quantity_decreasable is correctly used in the interface and prevents
 *   the user to decrease quantities.
 * - To check that warehouses (in the move and the default one of the user) are taken into account
 *   in quantity_decreasable
 * - To check that the fsm.stock.tracking wizard is taking the warehouses into account. When one line
 *   is implied in a move from a different warehouse than the current user's default one, an added
 *   column is displayed with the warehouse of the move implied by the line. The records that implies
 *   moves from another warehouse than the current user's default one are muted and readonly.
 */
registry.category("web_tour.tours").add('industry_fsm_stock_test_tour', {
    test: true,
    url: "/web",
    steps: () => [
    stepUtils.showAppsMenuItem(),
    ...StepToFSMProductsKanbanWithFavoritesFilterSteps,
    {
        content: 'Add quantity to the first product (no lot)',
        trigger: '.o_kanban_record:first-child button:has(i.fa-shopping-cart)',
        extra_trigger: '.o_kanban_record .o_kanban_record_title span:contains(Product A)',
    },
    {
        content: 'Add quantity to the first product (no lot)',
        trigger: '.o_kanban_record:first-child button:has(i.fa-plus)',
    },
    {
        content: 'Add quantity to the second product (lot)',
        trigger: '.o_kanban_record:nth-of-type(2) button:has(i.fa-shopping-cart)',
    },
    {
        content: 'Check that the warehouse column is not visible (thus that the second one is the Quantity)',
        trigger: 'div[name="tracking_line_ids"] table thead th:nth-of-type(2)[data-name="quantity"]',
    },
    ...AddTrackingLineAndValidateSteps,
    {
        trigger: '.o_back_button',
        content: 'go back to fsm',
    },
    {
        trigger: 'button[name="action_view_so"]',
        content: 'Go to the sale order',
    },
    {
        trigger: 'button[name="action_view_delivery"]',
        content: 'Go to the the delivery',
    },
    {
        trigger: 'button[name="button_validate"]',
        content: 'Validate delivery',
    },
    {
        trigger: '.o_back_button',
        content: 'Go back to SO',
    },
    {
        trigger: 'button[name="action_view_task"]',
        content: 'Go back to fsm task',
    },
    {
        trigger: 'button[name="action_fsm_view_material"]',
        content: 'Click on the Products stat button',
    },
    {
        content: 'Check that is it not possible to reduce the quantity of the first product (no lot) since it has been delivered',
        trigger: '.o_kanban_record:first-child:has(button:has(i.fa-trash)[disabled])',
        run: () => {},
    },
    {
        content: 'Check that is it not possible to reduce the quantity of the first product (lot) since it has been delivered',
        trigger: '.o_kanban_record:nth-of-type(2) .o_product_catalog_quantity:has(button:has(i.fa-minus)[disabled])',
        run: () => {},
    }, 
    {
        content: 'Add quantity to the first product (no lot)',
        trigger: '.o_kanban_record:first-child button:has(i.fa-plus)',
    },
    {
        content: 'Check that is it now possible to reduce the quantity of the first product (no lot) since we added quantities',
        trigger: '.o_kanban_record:first-child:not(button:has(i.fa-trash)[disabled])',
        run: () => {},
    },
    {
        content: 'Open the second product (lot) SN assignation wizard by using the plus button',
        trigger: '.o_kanban_record:nth-of-type(2) button:has(i.fa-plus)',
    },
    {
        content: 'Check that clicking on the plus button opened the Serial number assignation wizard',
        trigger: '.modal-content .modal-header .btn-close',
        extra_trigger: '.modal-content .modal-body .o_form_view_container div[name="tracking_line_ids"]',
    },
    {
        content: 'Open the second product (lot) SN assignation wizard by using the fa-list button',
        trigger: '.o_kanban_record:nth-of-type(2) button:has(i.fa-list)',
    },
    {
        content: 'Check that clicking on the fa-list button opened the Serial number assignation wizard',
        trigger: '.modal-content .modal-header .btn-close',
        extra_trigger: '.modal-content .modal-body .o_form_view_container div[name="tracking_line_ids"]',
    },
    {
        content: 'Open the second product (lot) SN assignation wizard by inputing a quantity',
        trigger: '.o_kanban_record:nth-of-type(2) .o_product_catalog_quantity .text-bg-light',
    },
    {
        content: 'Check that inputing a quantity opened the Serial number assignation wizard',
        trigger: '.modal-content .modal-body .o_form_view_container div[name="tracking_line_ids"]',
    },
    {
        content: 'Check that the Already Delivered list view is displayed',
        trigger: 'div[name="tracking_validated_line_ids"] table',
    },
    {
        content: 'Check that the warehouse column is not visible (thus that the second one is the Quantity)',
        trigger: 'div[name="tracking_line_ids"] table thead th:nth-of-type(2)[data-name="quantity"]',
    },
    ...AddTrackingLineAndValidateSteps,
    {
        content: 'Check that its now possible to reduce the quantity of the first product (lot) since we added new quantities to it',
        trigger: '.o_kanban_record:nth-of-type(2) .o_product_catalog_quantity:not(button:has(i.fa-minus)[disabled])',
        run: () => {},
    },
    {
        content: 'Open the second product (lot) SN assignation wizard by using the minus button',
        trigger: '.o_kanban_record:nth-of-type(2) button:has(i.fa-minus)',
    },
    {
        content: 'Check that clicking on the minus button opened the Serial number assignation wizard',
        trigger: '.modal-content .modal-header .btn-close',
        extra_trigger: '.modal-content .modal-body .o_form_view_container div[name="tracking_line_ids"]',
    },
    {
        content: 'Open user menu',
        trigger: 'div.o_user_menu button',
    },
    {
        content: 'Open the profile page',
        trigger: '.dropdown-menu .dropdown-item[data-menu="settings"]',
    },
    {
        content: 'Change the default warehouse to WH B',
        trigger: 'div[name="property_warehouse_id"] input[type="text"]',
        run: 'text WH B',
    },
    {
        content: 'Select WH B',
        trigger: ".ui-menu-item > a:contains(WH B)",
        auto: true,
        in_modal: false,
    },
    {
        content: 'Go back to app switcher',
        trigger: 'nav.o_main_navbar a.o_menu_toggle',
    },
    ...StepToFSMProductsKanbanWithFavoritesFilterSteps,
    {
        content: 'Check that is it not possible to reduce the quantity of the first product (no lot) because of the warehouse change',
        trigger: '.o_kanban_record:first-child:has(button:has(i.fa-trash)[disabled])',
    },
    {
        content: 'Check that is it not possible to reduce the quantity of the first product (lot) because of the warehouse change',
        trigger: '.o_kanban_record:nth-of-type(2) .o_product_catalog_quantity:has(button:has(i.fa-minus)[disabled])',
    }, 
    {
        content: 'Add quantity to the first product (lot)',
        trigger: '.o_kanban_record:nth-of-type(2) button:has(i.fa-plus)',
    },
    {
        content: 'Check that the warehouse column is visible',
        trigger: 'div[name="tracking_line_ids"] table thead th:nth-of-type(2)[data-name="warehouse_id"]',
    },
    {
        content: "Check that the previous entry which is in a different warehouse than the user's default one is muted and readonly",
        trigger: 'div[name="tracking_line_ids"] table tbody tr:first-child.text-muted td[name="quantity"].o_readonly_modifier',
    },
    ...AddTrackingLineAndValidateSteps,
    {
        content: 'Add quantity to the first product (lot)',
        trigger: '.o_kanban_record:nth-of-type(2) button:has(i.fa-plus)',
    },
    {
        content: 'Check that the warehouse column is visible',
        trigger: 'div[name="tracking_line_ids"] table thead th:nth-of-type(2)[data-name="warehouse_id"]',
    },
    {
        content: "Check that the previous entry which is in a different warehouse than the user's default one is muted and readonly",
        trigger: 'div[name="tracking_line_ids"] table tbody tr:first-child.text-muted td[name="quantity"].o_readonly_modifier',
    },
    {
        content: "Check that the previous entry which is in the same warehouse than the user's default one is not muted and editable",
        trigger: 'div[name="tracking_line_ids"] table tbody tr:nth-of-type(2):not(.text-muted) td[name="quantity"]:not(.o_readonly_modifier)',
    },
]});
