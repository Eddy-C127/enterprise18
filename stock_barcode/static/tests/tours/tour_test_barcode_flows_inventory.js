/** @odoo-module */

import helper from '@stock_barcode/../tests/tours/tour_helper_stock_barcode';
import { registry } from "@web/core/registry";
import { stepUtils } from "./tour_step_utils";

registry.category("web_tour.tours").add('test_inventory_adjustment', {test: true, steps: () => [

    {
        trigger: '.button_inventory',
        run: "click",
    },

    {
        trigger: '.o_scan_message.o_scan_product',
        run: function () {
            helper.assertScanMessage('scan_product');
            helper.assertValidateVisible(true);
            helper.assertValidateIsHighlighted(false);
            helper.assertValidateEnabled(false);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },
    {
        trigger: '.o_barcode_line',
        run: function () {
            // Checks the product code and name are on separate lines.
            const line = helper.getLine({ barcode: 'product1' });
            helper.assert(line.querySelectorAll('.o_barcode_line_details > .o_barcode_line_title > .o_barcode_product_ref').length, 1);
            helper.assert(line.querySelectorAll('.o_barcode_line_details .product-label').length, 1);
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },

    {
        trigger: '.o_edit',
        run: "click",
    },

    {
        trigger: '.o_field_widget[name="inventory_quantity"]',
        run: function () {
            helper.assertFormQuantity('2');
        }
    },

    {
        trigger: '.o_save',
        run: "click",
    },

    {
        trigger: '.o_barcode_line',
        run: function () {
            // Checks the product code and name are on separate lines.
            const line = helper.getLine({ barcode: 'product1' });
            helper.assert(line.querySelectorAll('.o_barcode_line_details > .o_barcode_line_title > .o_barcode_product_ref').length, 1);
            helper.assert(line.querySelectorAll('.o_barcode_line_details .product-label').length, 1);
        }
    },

    {
        trigger: '.o_add_line',
        run: "click",
    },

    {
        trigger: ".o_field_widget[name=product_id] input",
        run: "edit product2",
    },

    {
        trigger: ".ui-menu-item > a:contains('product2')",
        run: "click",
    },

    {
        trigger: ".o_field_widget[name=inventory_quantity] input",
        run: "edit 2",
    },

    {
        trigger: '.o_save',
        run: "click",
    },

    {
        extra_trigger: '.o_scan_message.o_scan_product',
        trigger: '.o_barcode_line',
        run: 'scan OBTVALI',
    },

    {
        trigger: '.o_stock_barcode_main_menu',
        run: "click",
    },

    {
        trigger: '.o_notification_bar.bg-success',
        run: function () {
            helper.assertErrorMessage('The inventory adjustment has been validated');
        },
    },
]});

registry.category("web_tour.tours").add('test_inventory_adjustment_dont_update_location', {test: true, steps: () => [
    {
        trigger: '.button_inventory',
        run: "click",
    },
    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertLinesCount(2);
            const [line1, line2] = helper.getLines({ barcode: 'product1' });
            helper.assertLineQty(line1, '0 / 5');
            helper.assertLineQty(line2, '0 / 5');
            helper.assertLineSourceLocation(line1, "WH/Stock");
            helper.assertLineSourceLocation(line2, "WH/Stock/Section 2");
        }
    },
    // Scan WH/Stock/Section 1.
    {
        trigger: '.o_barcode_client_action',
        run: "scan LOC-01-01-00"
    },
    {
        trigger: '.o_barcode_line:first-child',
        run: "click",
    },
    {
        trigger: '.o_barcode_line.o_selected button.o_add_quantity',
        run: "click",
    },
    {
        trigger: 'button.o_remove_unit:not([disabled])',
        run: function () {
            helper.assertLinesCount(2);
            const selectedLine = helper.getLine({ selected: true });
            helper.assertLineQty(selectedLine, '1 / 5');
            helper.assertLineSourceLocation(selectedLine, "WH/Stock");
        }
    },
    // Scans product1 -> A new line for this product should be created in Section 1.
    {
        trigger: '.o_barcode_client_action',
        run: "scan product1",
    },
    {
        trigger: '.o_barcode_line:nth-child(3)',
        run: function () {
            helper.assertLinesCount(3);
            const selectedLine = helper.getLine({ selected: true });
            helper.assertLineQty(selectedLine, '1');
            helper.assertLineSourceLocation(selectedLine, "WH/Stock/Section 1");
        }
    },
    ...stepUtils.validateBarcodeOperation('.o_apply_page.btn-success'),
]});

registry.category("web_tour.tours").add("test_inventory_adjustment_multi_company", {test: true, steps: () => [
    // Open the company switcher.
    {
        trigger: ".o_switch_company_menu > button",
        run: "click",
    },
    // Ensure the first company is selected and open the Barcode App, then the Inventory Adjustment.
    {
        extra_trigger: ".o_switch_company_menu .oe_topbar_name:contains('Comp A')",
        trigger: "[data-menu-xmlid='stock_barcode.stock_barcode_menu'] > .o_app_icon",
        run: "click",
    },
    {
        trigger: "button.button_inventory",
        run: "click",
    },
    // Scan product1 and product_no_company, they should be added in the inventory adj.
    {
        trigger: ".o_barcode_client_action",
        run: "scan product1",
    },
    {
        trigger: ".o_barcode_line[data-barcode='product1']",
        run: "scan product_no_company",
    },
    // Try to scan product2 who belongs to the second company -> Should not be found.
    {
        trigger: ".o_barcode_line[data-barcode='product_no_company']",
        run: "scan product2",
    },
    {
        extra_trigger: ".o_notification_bar.bg-danger",
        trigger: ".o_notification button.o_notification_close",
        run: "click",
    },
    {
        trigger: ".o_barcode_client_action",
        run: function() {
            helper.assertLinesCount(2);
        }
    },
    // Validate the Inventory Adjustment.
    {
        trigger: ".o_apply_page.btn-success",
        run: "click",
    },

    // Go back on the App Switcher and change the company.
    {
        trigger: ".o_stock_barcode_main_menu a.o_stock_barcode_menu",
        run: "click",
    },
    {
        trigger: ".o_switch_company_menu > button",
        run: "click",
    },
    {
        trigger: ".o-dropdown--menu .company_label:contains('Comp B')",
        run: "click",
    },
    // Open again the Barcode App then the Inventory Adjustment.
    {
        extra_trigger: ".o_switch_company_menu .oe_topbar_name:contains('Comp B')",
        trigger: "[data-menu-xmlid='stock_barcode.stock_barcode_menu'] > .o_app_icon",
        run: "click",
     },
    {
        trigger: "button.button_inventory",
        run: "click",
    },
    // Scan product2 and product_no_company, they should be added in the inventory adj.
    {
        trigger: ".o_barcode_client_action",
        run: "scan product2",
    },
    {
        trigger: ".o_barcode_line[data-barcode='product2']",
        run: "scan product_no_company",
    },
    // Try to scan product1 who belongs to the first company -> Should not be found.
    {
        trigger: ".o_barcode_line[data-barcode='product_no_company']",
        run: "scan product1",
    },
    {
        extra_trigger: ".o_notification_bar.bg-danger",
        trigger: ".o_notification button.o_notification_close",
        run: "click",
    },
    {
        trigger: ".o_barcode_client_action",
        run: function() {
            helper.assertLinesCount(2);
        }
    },
    // Validate the Inventory Adjustment.
    {
        trigger: ".o_barcode_line",
        run: "scan OBTVALI",
    },
    {
        trigger: ".o_stock_barcode_main_menu",
        extra_trigger: ".o_notification_bar.bg-success",
        run: function () {
            helper.assertErrorMessage("The inventory adjustment has been validated");
        },
    },
]});

registry.category("web_tour.tours").add('test_inventory_adjustment_multi_location', {test: true, steps: () => [
    {
        trigger: '.button_inventory',
        run: "click",
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-00-00'
    },
    {
        trigger: '.o_scan_message:contains("WH/Stock")',
        run: "click",
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },
    // Open manual scanner.
    {
        trigger: '.o_barcode_client_action .o_stock_mobile_barcode',
        run: "click",
    },
    // Manually add 'product1'.
    {
        trigger: '.modal-content .modal-body #manual_barcode',
        run: "edit product1",
    },
    // Apply the manual entry of barcode.
    {
        trigger: '.modal-content .modal-footer .btn-primary:not(:disabled)',
        run: "click",
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2',
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00'
    },
    {
        trigger: '.o_scan_message:contains("WH/Stock/Section 1")',
        run: "click",
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2',
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-02-00'
    },
    {
        trigger: '.o_scan_message:contains("WH/Stock/Section 2")',
        run: "click",
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan OBTVALI',
    },
    {
        trigger: '.o_stock_barcode_main_menu',
        run: function () {
            helper.assertErrorMessage('The inventory adjustment has been validated');
        },
    },
]});

registry.category("web_tour.tours").add('test_inventory_adjustment_tracked_product', {test: true, steps: () => [
    {
        trigger: '.button_inventory',
        run: "click",
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan productlot1',
    },
    {
        trigger: '.o_barcode_line:contains("productlot1")',
        run: 'scan lot1',
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot1',
    },
    {
        trigger: '.o_barcode_line.o_selected .qty-done:contains(2)',
        run: 'scan productserial1',
    },
    {
        trigger: '.o_barcode_line:contains("productserial1")',
        run: 'scan serial1',
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan serial1',
    },
    {
        trigger: '.o_notification_bar.bg-danger',
        run: function () {
            // Check that other lines is correct
            let line = helper.getLine({ barcode: 'productserial1' });
            helper.assertLineQty(line, "1");
            helper.assert(line.querySelector('.o_line_lot_name').innerText.trim(), 'serial1');
            line = helper.getLine({ barcode: 'productlot1' });
            helper.assertLineQty(line, "2");
            helper.assert(line.querySelector('.o_line_lot_name').innerText.trim(), 'lot1');
            helper.assertErrorMessage('The scanned serial number serial1 is already used.');
        },
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan serial2',
    },
    {
        trigger: '.o_barcode_line:contains("serial2")',
        run: 'scan productlot1',
    },
    {
        trigger: '.o_barcode_line:contains("productlot1")',
        run: 'scan lot1',
    },
    {
        trigger: '.o_barcode_line .qty-done:contains(3)',
        run: 'scan productserial1',
    },
    {
        trigger: '.o_barcode_line:contains("productserial1")',
        run: 'scan serial3',
    },
    {
        trigger: ':contains("productserial1") .o_sublines .o_barcode_line:contains("serial3")',
        run: function () {
            helper.assertLinesCount(2);
            helper.assertSublinesCount(3);
        },
    },
    // Edit a line to trigger a save.
    {
        trigger: '.o_add_line',
        run: "click",
    },
    {
        trigger: ".o_field_widget[name=product_id] input",
        run: "edit productserial1",
    },
    {
        trigger: ".ui-menu-item > a:contains('productserial1')",
        run: "click",
    },
    {
        trigger: '.o_save',
        run: "click",
    },
    // Scan tracked by lots product, then scan new lots.
    {
        trigger: '.o_sublines .o_barcode_line:nth-child(3)',
        run: function () {
            helper.assertLinesCount(2);
            helper.assertSublinesCount(4);
        },
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan productlot1',
    },
    {
        trigger: '.o_barcode_line.o_selected:contains("productlot1")',
        run: 'scan lot2',
    },
    {
        trigger: '.o_barcode_line .o_barcode_line:contains("lot2")',
        run: 'scan lot3',
    },
    // Must have 6 lines in two groups: lot1, lot2, lot3 and serial1, serial2, serial3.
    // Grouped lines for `productlot1` should be unfolded.
    {
        trigger: '.o_barcode_line:contains("productlot1") .o_sublines>.o_barcode_line.o_selected:contains("lot3")',
        run: function () {
            helper.assertLinesCount(2);
            helper.assertSublinesCount(3);
        }
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan OBTVALI',
    },
    {
        trigger: '.modal-header',
        run: "click",
    },
    {
        trigger: 'button[name="action_confirm"]',
        run: "click",
    },
    {
        trigger: '.o_notification_bar.bg-success',
        run: "click",
    },
    {
        trigger: '.o_stock_barcode_main_menu',
        run: function () {
            helper.assertErrorMessage('The inventory adjustment has been validated');
        },
    },
]});

registry.category("web_tour.tours").add('test_inventory_adjustment_tracked_product_multilocation', {test: true, steps: () => [
    {
        trigger: '.button_inventory',
        run: "click",
    },
    {
        trigger: '.o_barcode_line',
        run: function() {
            helper.assertLinesCount(2);
            helper.assertLineSourceLocation(0, "WH/Stock/Section 1");
            helper.assertLineQty(0, "3 / 3");
            helper.assertLineSourceLocation(1, "WH/Stock/Section 2");
            helper.assertLineQty(1, "0 / 5");
        }
    },
    // Scans Section 1 then scans productlot1 -> It should update the first productlot1's line.
    {
        trigger: '.o_barcode_line',
        run: 'scan LOC-01-01-00',
    },
    {
        trigger: '.o_barcode_line:first-child [name=source_location].o_highlight',
        run: 'scan lot1',
    },
    {
        trigger: '.o_barcode_line:first-child.o_selected',
        run: function() {
            helper.assertLineSourceLocation(0, "WH/Stock/Section 1");
            helper.assertLineQty(0, "4 / 3");
            helper.assertLineSourceLocation(1, "WH/Stock/Section 2");
            helper.assertLineQty(1, "0 / 5");
        }
    },
    // Scans productserial1 -> As we are in Section 1, it should get sn1, sn2 and sn3.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan productserial1',
    },
    {
        trigger: '.o_barcode_line:nth-child(2).o_selected',
        run: function() {
            helper.assertLinesCount(3);
            const serialLine = helper.getLine({ barcode: "productserial1" });
            helper.assertLineSourceLocation(serialLine, "WH/Stock/Section 1");
            helper.assertLineQty(1, "? / 3");
            helper.assertSublinesCount(3)
            const [subline1, subline2, subline3] = helper.getSublines();
            helper.assertLineQty(subline1, "? / 1");
            helper.assertLineQty(subline2, "? / 1");
            helper.assertLineQty(subline3, "? / 1");
            helper.assert(subline1.querySelector('.o_line_lot_name').innerText, "sn1");
            helper.assert(subline2.querySelector('.o_line_lot_name').innerText, "sn2");
            helper.assert(subline3.querySelector('.o_line_lot_name').innerText, "sn3");
        }
    },
    // Hides sublines.
    {
        trigger: '.o_barcode_line.o_selected .btn.o_toggle_sublines .fa-caret-up',
        run: "click",
    },
    // Scans Section 2 then scans productlot1 -> It should update the second productlot1's line.
    {
        trigger: '.o_barcode_line', 
        run: 'scan LOC-01-02-00',
    },
    {
        trigger: '.o_barcode_line:nth-child(3) [name=source_location].o_highlight',
        run: 'scan lot1',
    },
    {
        trigger: '.o_barcode_line:nth-child(3).o_selected',
        run: function() {
            const [lotLine1, lotLine2] = helper.getLines({ barcode: "productlot1" });
            helper.assertLineSourceLocation(lotLine1, "WH/Stock/Section 1");
            helper.assertLineQty(0, "4 / 3");
            helper.assertLineSourceLocation(lotLine2, "WH/Stock/Section 2");
            helper.assertLineQty(2, "1 / 5");
        }
    },
    // Scans productserial1 -> No existing quant in Section 2 for this product so creates a new line.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan productserial1',
    },
    {
        trigger: '.o_barcode_line:nth-child(4).o_selected',
        run: function() {
            helper.assertLinesCount(4);
            const [serialLine1, serialLine2] = helper.getLines({ barcode: 'productserial1' });
            helper.assertLineSourceLocation(serialLine1, "WH/Stock/Section 1");
            helper.assertLineQty(serialLine1, "? / 3");
            helper.assertLineSourceLocation(serialLine2, "WH/Stock/Section 2");
            helper.assertLineQty(serialLine2, "0");
        }
    },
    ...stepUtils.validateBarcodeOperation(),
    {
        trigger: '.o_stock_barcode_main_menu',
        run: function () {
            helper.assertErrorMessage('The inventory adjustment has been validated');
        },
    },
]});

registry.category("web_tour.tours").add('test_inventory_adjustment_tracked_product_permissive_quants', {test: true, steps: () => [
    {
        trigger: '.button_inventory',
        run: "click",
    },
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertLinesCount(0);
        }
    },

    // Scan a product tracked by lot that has a quant without lot_id, then scan a product's lot.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan productlot1',
    },
    {
        trigger: '.o_barcode_line:contains("productlot1")',
        run: function() {
            helper.assertLinesCount(1);
            helper.assertSublinesCount(0);
            const line = helper.getLine();
            helper.assertLineQty(line, "? / 5");
        }
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot1',
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot1',
    },
    // Must have 2 lines in one group: one without lot and one with lot1.
    // Grouped lines for `productlot1` should be unfolded.
    {
        trigger: '.o_sublines .o_barcode_line.o_selected:contains("lot1") .qty-done:contains(2)',
        run: function () {
            helper.assertLinesCount(1);
            helper.assertSublinesCount(2);
            const [subline1, subline2] = helper.getSublines();
            helper.assertLineQty(subline1, "? / 5");
            helper.assertLineQty(subline2, "2");
        }
    },

    {
        trigger: '.o_sublines .o_barcode_line:first-child .o_line_button.o_set:not(.o_difference)',
        run: "click",
    },
    ...stepUtils.validateBarcodeOperation('.o_sublines .o_barcode_line:first-child .o_line_button.o_set .fa-check'),

    {
        trigger: '.o_stock_barcode_main_menu',
        run: function () {
            helper.assertErrorMessage('The inventory adjustment has been validated');
        },
    },
]});

registry.category("web_tour.tours").add('test_inventory_create_quant', {test: true, steps: () => [
    {
        trigger: '.button_inventory',
        run: "click",
    },
    {
        trigger: '.o_barcode_client_action',
        run: function () {
            helper.assertLinesCount(0);
        }
    },

    // Scans product 1: must have 1 quantity and buttons +1/-1 must be visible.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },
    {
        trigger: '.o_barcode_client_action .o_barcode_line',
        run: function () {
            helper.assertLinesCount(1);
            const line = helper.getLine({ barcode: "product1" });
            helper.assertLineIsHighlighted(line, true);
            helper.assertLineQty(line, "1");
            helper.assertButtonShouldBeVisible(line, "add_quantity");
            helper.assertButtonShouldBeVisible(line, "remove_unit");
        }
    },

    // Edits the line to set the counted quantity to zero.
    {
        trigger: '.o_edit',
        run: "click",
    },
    {
        trigger: '.o_field_widget[name="product_id"]',
        run: function() {
            helper.assertFormQuantity("1");
        },
    },
    {
        trigger: '.o_field_widget[name=inventory_quantity] input',
        run: "edit 0",
    },
    {
        trigger: '.o_save',
        run: "click",
    },
    {
        trigger: '.o_barcode_client_action .o_barcode_line',
        run: function () {
            helper.assertLinesCount(1);
            const line = helper.getLine({ barcode: "product1" });
            helper.assertLineQty(line, "0");
        }
    },
]});

registry.category("web_tour.tours").add("test_inventory_image_visible_for_quant", {test: true, steps: () => [
    { trigger: "button.button_inventory", run: "click" },
    { trigger: ".o_barcode_line:first-child button.o_edit", run: "click" },
    {
        trigger: ".o_form_view",
        run: function() {
            const imgEl = document.querySelector("div[name=image_1920] img");
            helper.assert(Boolean(imgEl), true, "Product image should be visible");
        }
    },
    { trigger: "button.o_discard", run: "click" },
    { trigger: ".o_barcode_line:nth-child(2) button.o_edit", run: "click" },
    {
        trigger: ".o_form_view",
        run: function() {
            const imgEl = document.querySelector("div[name=image_1920] img");
            helper.assert(Boolean(imgEl), false, "Product has no image set");
        }
    },
]});

registry.category("web_tour.tours").add('test_inventory_nomenclature', {test: true, steps: () => [
    {
        trigger: '.button_inventory',
        run: "click",
    },
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertScanMessage('scan_product');
        },
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan 2145631123457', // 12.345 kg
    },
    {
        trigger: '.product-label:contains("product_weight")',
        run: "click",
    },
    ...stepUtils.validateBarcodeOperation(),
    {
        trigger: '.o_stock_barcode_main_menu',
        run: function () {
            helper.assertErrorMessage('The inventory adjustment has been validated');
        },
    },
]});

registry.category("web_tour.tours").add('test_inventory_package', {test: true, steps: () => [
    {
        trigger: '.button_inventory',
        run: "click",
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan PACK001',
    },
    {
        trigger: '.o_barcode_line:contains("product2") .o_edit',
        run: "click",
    },
    {
        trigger: '[name="inventory_quantity"] input',
        run: "edit 21",
    },
    {
        trigger: '.o_save',
        run: "click",
    },
    {
        trigger: '.o_apply_page',
        run: "click",
    },

    {
        trigger: '.o_notification_bar.bg-success',
        run: function () {
            helper.assertErrorMessage('The inventory adjustment has been validated');
        },
    },

    {
        trigger: '.o_stock_barcode_main_menu',
    },
]});

registry.category("web_tour.tours").add('test_inventory_packaging', {test: true, steps: () => [
    {
        trigger: '.button_inventory',
        run: "click",
    },
    // Scans a packaging when there is no existing quant for its product.
    {
        trigger: '.o_barcode_client_action', 
        run: 'scan pack007',
    },
    {
        trigger: '.o_barcode_line',
        run: function() {
            const $line = helper.getLine({ barcode: "product1"});
            helper.assertLineQty($line, "15");
        }
    },
    {
        trigger: '.o_apply_page',
        run: "click",
    },
    {
        trigger: '.o_notification_bar.bg-success',
        run: "click",
    },
    {
        trigger: '.button_inventory',
        run: "click",
    },
    // Scans a packaging when a quant for its product exists.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan pack007',
    },
    // Verifies it takes the packaging's quantity.
    {
        extra_trigger: '.o_barcode_line .qty-done:contains(15)',
        trigger: '.o_apply_page',
        run: "click",
    },
    {
        trigger: '.o_notification_bar.bg-success',
    },
]});

registry.category("web_tour.tours").add('test_inventory_owner_scan_package', {test: true, steps: () => [
    {
        trigger: '.button_inventory',
        run: "click",
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan P00001',
    },
    {
        trigger: '.o_barcode_client_action:contains("P00001")',
        run: "click",
    },
    {
        trigger: '.o_barcode_client_action:contains("Azure Interior")',
        run: "click",
    },
    ...stepUtils.validateBarcodeOperation(),
]});

registry.category("web_tour.tours").add('test_inventory_using_buttons', {test: true, steps: () => [
    {
        trigger: '.button_inventory',
        run: "click",
    },

    // Scans product 1: must have 1 quantity and buttons +1/-1 must be visible.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },
    {
        trigger: '.o_barcode_client_action .o_barcode_line',
        run: function () {
            helper.assertLinesCount(1);
            const line = helper.getLine({ barcode: "product1" });
            helper.assertLineIsHighlighted(line, true);
            helper.assertLineQty(line, "1");
            helper.assertButtonShouldBeVisible(line, "add_quantity");
            helper.assertButtonShouldBeVisible(line, "remove_unit");
        }
    },
    // Clicks on -1 button: must have 0 quantity, -1 still visible but disabled.
    {
        trigger: '.o_remove_unit',
        run: "click",
    },
    {
        trigger: '.o_barcode_line:contains("0")',
        run: function () {
            helper.assertLinesCount(1);
            const line = helper.getLine({ barcode: 'product1' });
            helper.assertLineIsHighlighted(line, true);
            helper.assertLineQty(line, '0');
            helper.assertButtonShouldBeVisible(line, 'add_quantity');
            helper.assertButtonShouldBeVisible(line, 'remove_unit');
            const decrementButton = document.querySelector('.o_line_button.o_remove_unit');
            helper.assert(decrementButton.hasAttribute('disabled'), true);
        }
    },
    // Clicks on +1 button: must have 1 quantity, -1 must be enabled now.
    {
        trigger: '.o_add_quantity',
        run: "click",
    },
    {
        trigger: '.o_barcode_line .qty-done:contains("1")',
        run: function () {
            helper.assertLinesCount(1);
            const line = helper.getLine({ barcode: 'product1' });
            helper.assertLineIsHighlighted(line, true);
            helper.assertLineQty(line, '1');
            helper.assertButtonShouldBeVisible(line, 'add_quantity');
            helper.assertButtonShouldBeVisible(line, 'remove_unit');
            const decrementButton = line.querySelector('.o_line_button.o_remove_unit');
            helper.assert(decrementButton.hasAttribute('disabled'), false);
        }
    },

    // Scans productserial1: must have 0 quantity, buttons must be hidden (a
    // line for a product tracked by SN doesn't have -1/+1 buttons).
    {
        trigger: '.o_barcode_client_action',
        run: 'scan productserial1',
    },
    {
        trigger: '.o_barcode_client_action .o_barcode_line:nth-child(2)',
        run: function () {
            helper.assertLinesCount(2);
            const line = helper.getLine({ barcode: 'productserial1', selected: true });
            helper.assertLineIsHighlighted(line, true);
            helper.assertLineQty(line, '0');
            helper.assertButtonShouldBeVisible(line, 'add_quantity', false);
            helper.assertButtonShouldBeVisible(line, 'remove_unit', false);
            const setButton = line.querySelector('.o_line_button.o_set > .fa-check');
            helper.assert(Boolean(setButton), true);
        }
    },
    // Scans a serial number: must have 1 quantity, check button must display a "X".
    {
        trigger: '.o_barcode_client_action',
        run: 'scan BNG-118',
    },
    {
        trigger: '.o_barcode_line:contains("BNG-118")',
        run: function () {
            helper.assertLinesCount(2);
            const line = helper.getLine({ barcode: 'productserial1', selected: true });
            helper.assertLineIsHighlighted(line, true);
            helper.assertLineQty(line, '1');
            helper.assertButtonShouldBeVisible(line, 'add_quantity', false);
            helper.assertButtonShouldBeVisible(line, 'remove_unit', false);
            const setButton = line.querySelector('.o_line_button.o_set.o_difference');
            helper.assert(Boolean(setButton), true);
        }
    },
    // Clicks on set button: must set the inventory quantity equals to the quantity .
    {
        trigger: '.o_barcode_line:contains("productserial1") .o_line_button.o_set',
        run: "click",
    },
    {
        trigger: '.o_barcode_line.o_selected .fa-check',
        run: function () {
            helper.assertLinesCount(2);
            const line = helper.getLine({ barcode: 'productserial1' });
            helper.assertLineIsHighlighted(line, true);
            helper.assertLineQty(line, '0');
            helper.assertButtonShouldBeVisible(line, 'add_quantity', false);
            helper.assertButtonShouldBeVisible(line, 'remove_unit', false);
            const goodQuantitySetButton = document.querySelector('.o_selected .o_line_button.o_set > .fa-check');
            helper.assert(Boolean(goodQuantitySetButton), true);
            const differenceSetButton = document.querySelector('.o_selected .o_line_button.o_set.o_difference');
            helper.assert(Boolean(differenceSetButton), false);
        }
    },
    // Clicks again on set button: must unset the quantity.
    {
        trigger: '.o_barcode_line:contains("productserial1") .o_line_button.o_set',
        run: "click",
    },
    {
        trigger: '.o_barcode_line:contains("productserial1"):contains("?")',
        run: function () {
            helper.assertLinesCount(2);
            const line = helper.getLine({ barcode: 'productserial1', selected: true });
            helper.assertLineIsHighlighted(line, true);
            helper.assertLineQty(line, '?');
            helper.assertButtonShouldBeVisible(line, 'add_quantity', false);
            helper.assertButtonShouldBeVisible(line, 'remove_unit', false);
            const goodQuantitySetButton = line.querySelector('.o_line_button.o_set > .fa-check');
            helper.assert(Boolean(goodQuantitySetButton), false);
            const differenceSetButton = line.querySelector('.o_line_button.o_set.o_difference');
            helper.assert(Boolean(differenceSetButton), false);
            const emptySetButton = line.querySelector('.o_line_button.o_set');
            helper.assert(Boolean(emptySetButton), true);
        }
    },

    // Scans productlot1: must have 0 quantity, buttons should be visible.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan productlot1',
    },
    {
        trigger: '.o_barcode_client_action .o_barcode_line:nth-child(3)',
        run: function () {
            helper.assertLinesCount(3);
            const line = helper.getLine({ barcode: 'productlot1' });
            helper.assertLineIsHighlighted(line, true);
            helper.assertLineQty(line, '0');
            helper.assertButtonShouldBeVisible(line, 'add_quantity');
            helper.assertButtonShouldBeVisible(line, 'remove_unit');
            const decrementButton = line.querySelector('.o_line_button.o_remove_unit');
            helper.assert(decrementButton.hasAttribute('disabled'), true);
        }
    },
    // Scans a lot number: must have 1 quantity, buttons should still be visible.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan toto-42',
    },
    {
        trigger: '.o_barcode_line:contains("toto-42")',
        run: function () {
            helper.assertLinesCount(3);
            const line = helper.getLine({ barcode: 'productlot1' });
            helper.assertLineIsHighlighted(line, true);
            helper.assertLineQty(line, '1');
            helper.assertButtonShouldBeVisible(line, 'add_quantity');
            helper.assertButtonShouldBeVisible(line, 'remove_unit');
            const decrementButton = line.querySelector('.o_line_button.o_remove_unit');
            helper.assert(decrementButton.hasAttribute('disabled'), false);
        }
    },
    // Clicks on -1 button: must have 0 quantity, button -1 must be disabled again.
    {
        trigger: '.o_barcode_line:contains("productlot1") .o_remove_unit',
        run: "click",
    },
    {
        trigger: '.o_barcode_line:contains("productlot1") .qty-done:contains("0")',
        run: function () {
            helper.assertLinesCount(3);
            const line = helper.getLine({ barcode: 'productlot1' });
            helper.assertLineIsHighlighted(line, true);
            helper.assertLineQty(line, '0');
            helper.assertButtonShouldBeVisible(line, 'add_quantity');
            helper.assertButtonShouldBeVisible(line, 'remove_unit');
            const decrementButton = line.querySelector('.o_line_button.o_remove_unit');
            helper.assert(decrementButton.hasAttribute('disabled'), true);
        }
    },
    // Clicks on +1 button: must have 1 quantity, buttons must be visible.
    {
        trigger: '.o_barcode_line:contains("productlot1") .o_add_quantity',
        run: "click",
    },
    {
        trigger: '.o_barcode_line:contains("productlot1") .qty-done:contains(1)',
        run: function () {
            helper.assertLinesCount(3);
            const line = helper.getLine({ barcode: 'productlot1' });
            helper.assertLineIsHighlighted(line, true);
            helper.assertLineQty(line, '1');
            helper.assertButtonShouldBeVisible(line, 'add_quantity');
            helper.assertButtonShouldBeVisible(line, 'remove_unit');
            const decrementButton = line.querySelector('.o_line_button.o_remove_unit');
            helper.assert(decrementButton.hasAttribute('disabled'), false);
        }
    },

    // Scans product2 => Should retrieve the quantity on hand and display 1/10.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2',
    },
    {
        trigger: '.o_barcode_line:contains("product2")',
        run: function () {
            helper.assertLinesCount(4);
            const line = helper.getLine({ barcode: 'product2', selected: true });
            helper.assertLineIsHighlighted(line, true);
            helper.assertLineQty(line, '1 / 10');
            helper.assertButtonShouldBeVisible(line, 'add_quantity');
            helper.assertButtonShouldBeVisible(line, 'remove_unit');
            const setButton = line.querySelector('.o_line_button.o_set.o_difference');
            helper.assert(Boolean(setButton), true);
        }
    },
    // Clicks multiple time on the set quantity button and checks the save is rightly done.
    {
        trigger: '.o_selected .o_line_button.o_set.o_difference',
        run: "click",
    },
    {
        trigger: '.o_barcode_line:contains("product2"):contains("?")',
        run: function () {
            const line = document.querySelector('.o_barcode_line[data-barcode=product2]');
            const qty = line.querySelector('.o_barcode_scanner_qty').textContent;
            helper.assert(qty, '?/ 10');
        }
    },
    // Goes to the quant form view to trigger a save then go back.
    {
        trigger: '.o_selected .o_line_button.o_edit',
        run: "click",
    },
    {
        trigger: '.o_discard',
        run: "click",
    },
    {
        trigger: '.o_barcode_line:contains("product2"):contains("?")',
        run: function () {
            const line = document.querySelector('.o_barcode_line[data-barcode=product2]');
            const qty = line.querySelector('.o_barcode_scanner_qty').textContent;
            helper.assert(qty, '?/ 10');
        }
    },

    // Clicks again, should pass from  "? / 10" to "10 / 10"
    {
        trigger: '.o_barcode_line:contains("product2") .o_line_button.o_set',
        run: "click",
    },
    {
        trigger: '.o_barcode_line:contains("product2") .qty-done:contains("10")',
        run: function () {
            const line = document.querySelector('.o_barcode_line[data-barcode=product2]');
            const qty = line.querySelector('.o_barcode_scanner_qty').textContent;
            helper.assert(qty, '10/ 10');
        }
    },
    // Goes to the quant form view to trigger a save then go back.
    {
        trigger: '.o_barcode_line:contains("product2") .o_line_button.o_edit',
        run: "click",
    },
    {
        trigger: '.o_discard',
        run: "click",
    },
    {
        trigger: '.o_barcode_line:contains("product2") .qty-done:contains("10")',
        run: function () {
            const line = document.querySelector('.o_barcode_line[data-barcode=product2]');
            const qty = line.querySelector('.o_barcode_scanner_qty').textContent;
            helper.assert(qty, '10/ 10');
        }
    },

    // Clicks again, should pass from  "10 / 10" to "? / 10"
    {
        trigger: '.o_barcode_line:contains("product2") .o_line_button.o_set .fa-check',
        run: "click",
    },
    {
        trigger: '.o_barcode_line:contains("product2"):contains("?")',
        run: function () {
            const line = document.querySelector('.o_barcode_line[data-barcode=product2]');
            const qty = line.querySelector('.o_barcode_scanner_qty').textContent;
            helper.assert(qty, '?/ 10');
        }
    },

    // Validates the inventory.
    {
        trigger: '.o_apply_page',
        run: "click",
    },
    {
        trigger: '.o_notification_bar.bg-success',
    }
]});

registry.category("web_tour.tours").add('test_inventory_setting_show_quantity_to_count_on', {test: true, steps: () => [
    {
        trigger: '.button_inventory',
        run: "click",
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-00-00',
    },
    {
        trigger: '.o_barcode_line',
        run: function () {
            helper.assertLinesCount(3);
            const [line1, line2, line3] = helper.getLines();
            helper.assertLineProduct(line1, 'product1');
            helper.assertLineProduct(line2, 'productlot1');
            helper.assertLineProduct(line3, 'productserial1');
            helper.assertButtonShouldBeVisible(line1, "set");
            helper.assertLineIsHighlighted(line1, false);
            helper.assertLineIsHighlighted(line2, false);
            helper.assertLineIsHighlighted(line3, false);
            helper.assertLineQty(line1, "? / 5");
            helper.assertLineQty(line2, "? / 7");
            helper.assertLineQty(line3, "? / 3");
            helper.assertLineSourceLocation(line1, "WH/Stock");
            helper.assertLineSourceLocation(line2, "WH/Stock");
            helper.assertLineSourceLocation(line3, "WH/Stock");
        }
    },
    {
        trigger: '.o_barcode_line:contains("product1")',
        run: "click",
    },
    {
        trigger: '.o_barcode_line:contains("product1").o_selected',
        run: function () {
            const line = helper.getLine({ barcode: "product1" });
            helper.assertButtonShouldBeVisible(line, "add_quantity");
            helper.assertButtonShouldBeVisible(line, "remove_unit");
            helper.assertButtonShouldBeVisible(line, "set");
        }
    },
    {
        trigger: ".o_barcode_line.o_selected .o_line_button.o_edit",
        run: "click",
    },
    {
        content: "Check button to add expected quantity is visible",
        extra_trigger: '.o_button_qty_done:contains("5")',
        trigger: '.o_barcode_control .o_discard',
        run: "click",
    },
    { 
        trigger: '.o_barcode_line:contains("productlot1")',
        run: "click",
    },
    {
        trigger: '.o_barcode_line.o_selected .o_line_button.o_toggle_sublines',
        run: function () {
            helper.assertSublinesCount(2);
            const [subline1, subline2] = helper.getSublines();
            helper.assertLineQty(subline1, "? / 3");
            helper.assertLineQty(subline2, "? / 4");
            helper.assert(subline1.querySelector('.o_line_lot_name').innerText, "lot1");
            helper.assert(subline2.querySelector('.o_line_lot_name').innerText, "lot2");
            helper.assertButtonShouldBeVisible(subline1, "add_quantity");
            helper.assertButtonShouldBeVisible(subline1, "remove_unit");
            helper.assertButtonShouldBeVisible(subline1, "set");
            helper.assertButtonShouldBeVisible(subline2, "set");
        }
    },
    {
        trigger: '.o_barcode_line:contains("productserial1")',
        run: "click",
    },
    {
        trigger: '.o_barcode_line.o_selected .o_line_button.o_toggle_sublines .fa-caret-up',
        run: function () {
            helper.assertSublinesCount(3);
            const [subline1, subline2, subline3] = helper.getSublines();
            helper.assertLineQty(subline1, "? / 1");
            helper.assertLineQty(subline2, "? / 1");
            helper.assertLineQty(subline3, "? / 1");
            helper.assert(subline1.querySelector('.o_line_lot_name').innerText, "sn1");
            helper.assert(subline2.querySelector('.o_line_lot_name').innerText, "sn2");
            helper.assert(subline3.querySelector('.o_line_lot_name').innerText, "sn3");
            helper.assertButtonShouldBeVisible(subline1, "set");
            helper.assertButtonShouldBeVisible(subline2, "set");
            helper.assertButtonShouldBeVisible(subline3, "set");
        }
    },
]});

registry.category("web_tour.tours").add('test_inventory_setting_show_quantity_to_count_off', {test: true, steps: () => [
    {
        trigger: '.button_inventory',
        run: "click",
    },
    {
        trigger: '.o_barcode_client_action', 
        run: 'scan LOC-01-00-00',
    },
    {
        trigger: '.o_barcode_line',
        run: function () {
            helper.assertLinesCount(3);
            const [line1, line2, line3] = helper.getLines();
            helper.assertLineProduct(line1, 'product1');
            helper.assertLineProduct(line2, 'productlot1');
            helper.assertLineProduct(line3, 'productserial1');
            helper.assertButtonShouldBeVisible(line1, "set", false);
            helper.assertLineIsHighlighted(line1, false);
            helper.assertLineIsHighlighted(line2, false);
            helper.assertLineIsHighlighted(line3, false);
            helper.assertLineQty(line1, "?");
            helper.assertLineQty(line2, "?");
            helper.assertLineQty(line3, "?");
            helper.assertLineSourceLocation(line1, "WH/Stock");
            helper.assertLineSourceLocation(line2, "WH/Stock");
            helper.assertLineSourceLocation(line3, "WH/Stock");
        }
    },
    {
        trigger: '.o_barcode_line:contains("product1")',
        run: "click",
    },
    {
        trigger: '.o_barcode_line:contains("product1").o_selected',
        run: function () {
            const line = helper.getLine({ barcode: "product1" });
            helper.assertButtonShouldBeVisible(line, "add_quantity");
            helper.assertButtonShouldBeVisible(line, "remove_unit");
            helper.assertButtonShouldBeVisible(line, "set", false);
        }
    },
    {
        trigger: ".o_barcode_line.o_selected .o_line_button.o_edit",
        run: "click",
    },
    {
        trigger: '.o_form_view_container',
        run: function() {
            helper.assert(
                Boolean(document.querySelector(".o_button_qty_done")), false,
                "Button to set counted quantity shouldn't be visible");
        },
    },
    {
        trigger: '.o_barcode_control .o_discard',
        run: "click",
    },

    {
        trigger: '.o_barcode_line:contains("productlot1")',
        run: "click",
    },
    {
        trigger: '.o_barcode_line.o_selected .o_line_button.o_toggle_sublines',
        run: function () {
            helper.assertSublinesCount(2);
            const [subline1, subline2] = helper.getSublines();
            helper.assertLineQty(subline1, "?");
            helper.assertLineQty(subline2, "?");
            helper.assert(subline1.querySelector('.o_line_lot_name').innerText, "lot1");
            helper.assert(subline2.querySelector('.o_line_lot_name').innerText, "lot2");
            helper.assertButtonShouldBeVisible(subline1, "add_quantity");
            helper.assertButtonShouldBeVisible(subline1, "remove_unit");
            helper.assertButtonShouldBeVisible(subline1, "set", false);
            helper.assertButtonShouldBeVisible(subline2, "set", false);
        }
    },
    {
        trigger: '.o_barcode_line:contains("productserial1")',
        run: "click",
    },
    {
        trigger: '.o_barcode_line.o_selected .o_line_button.o_toggle_sublines .fa-caret-up',
        run: function () {
            helper.assertSublinesCount(3);
            const [subline1, subline2, subline3] = helper.getSublines();
            helper.assertLineQty(subline1, "?");
            helper.assertLineQty(subline2, "?");
            helper.assertLineQty(subline3, "?");
            helper.assert(subline1.querySelector('.o_line_lot_name').innerText, "sn1");
            helper.assert(subline2.querySelector('.o_line_lot_name').innerText, "sn2");
            helper.assert(subline3.querySelector('.o_line_lot_name').innerText, "sn3");
            // For product tracked by SN, the set button should be visible no matter the parameter.
            helper.assertButtonShouldBeVisible(subline1, "set");
            helper.assertButtonShouldBeVisible(subline2, "set");
            helper.assertButtonShouldBeVisible(subline3, "set");
        }
    },
]});

registry.category("web_tour.tours").add('test_inventory_setting_count_entire_locations_on', {test: true, steps: () => [
    {
        trigger: '.button_inventory',
        run: "click",
    },
    // At first, only the marked as to count quant should be visible.
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertLinesCount(1);
            const line = helper.getLine();
            helper.assertLineProduct(line, 'product1');
            helper.assertLineQty(line, "10 / 10");
            helper.assertLineSourceLocation(line, "WH/Stock/Section 1");
        }
    },
    // Scan WH/Stock/Section 1 => Should fetch all quants in this location.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00',
    },
    // Check that all quants of WH/Stock/Section 1 are loaded with their respective information.
    {
        trigger: '.o_barcode_line:nth-child(4)',
        run: function () {
            helper.assertLinesCount(4);
            const [line1, line2, line3, line4] = helper.getLines();
            helper.assertLineProduct(line1, 'product1');
            helper.assertLineProduct(line2, 'product2');
            helper.assertLineProduct(line3, 'productlot1');
            helper.assertLineProduct(line4, 'productserial1');
            helper.assertLineQty(line1, "10 / 10");
            helper.assertLineQty(line2, "? / 20");
            helper.assertLineQty(line3, "? / 7");
            helper.assertLineQty(line4, "? / 3");
            helper.assertLineSourceLocation(line1, "WH/Stock/Section 1");
            helper.assertLineSourceLocation(line2, "WH/Stock/Section 1");
            helper.assertLineSourceLocation(line3, "WH/Stock/Section 1");
            helper.assertLineSourceLocation(line4, "WH/Stock/Section 1");
        }
    },

    // Scan WH/Stock/Section 2 => Should fetch all quants in this location.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-02-00',
    },
    // Check that all quants of WH/Stock/Section 2 are loaded with their respective information.
    {
        trigger: '.o_barcode_line .o_line_source_location:contains("Section 2")',
        run: function () {
            helper.assertLinesCount(7);
            helper.assertLineProduct(4, '[TEST] product1');
            helper.assertLineQty(4, "? / 30");
            helper.assertLineSourceLocation(4, "WH/Stock/Section 2");
            helper.assertLineProduct(5, 'productlot1');
            helper.assertLineQty(5, "? / 7");
            helper.assertLineSourceLocation(5, "WH/Stock/Section 2");
            helper.assertLineProduct(6, 'productserial1');
            helper.assertLineQty(6, "? / 3");
            helper.assertLineSourceLocation(6, "WH/Stock/Section 2");
        }
    },
]});

registry.category("web_tour.tours").add('test_inventory_setting_count_entire_locations_off', {test: true, steps: () => [
    {
        trigger: '.button_inventory',
        run: "click",
    },
    // Only the marked as to count quant should be visible.
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            helper.assertLinesCount(1);
            helper.assertLineProduct(0, 'product1');
            helper.assertLineQty(0, "10 / 10");
            helper.assertLineSourceLocation(0, "WH/Stock/Section 1");
        }
    },
    // Scan WH/Stock/Section 1 => Should not fetch other quants.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan LOC-01-01-00',
    },
    {
        trigger: '.o_barcode_line [name="source_location"].o_highlight',
        run: function () {
            helper.assertLinesCount(1);
            helper.assertLineProduct(0, 'product1');
            helper.assertLineQty(0, "10 / 10");
            helper.assertLineSourceLocation(0, "WH/Stock/Section 1");
        }
    },
]});
