/** @odoo-module **/

import { click, getFixture, editInput, patchWithCleanup } from "@web/../tests/helpers/utils";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";
import { deepCopy } from "@web/core/utils/objects";
import { browser } from "@web/core/browser/browser";
import { saleOrderLineInfo, fsmProductMakeViewParams } from "@industry_fsm_sale/../tests/product_catalog_tests";

let target;

for (const product in saleOrderLineInfo) {
    saleOrderLineInfo[product].deliveredQty = 0; // looks like i have to set these props even tho they only appear in industry_fsm_stock
    saleOrderLineInfo[product].minimumQuantityOnProduct = 0;
    saleOrderLineInfo[product].tracking = false;
}

export const stockSaleOrderLineInfo = {
    1: {
        quantity: 0,
        readOnly: false,
        price: 14,
        deliveredQty: 0,
        minimumQuantityOnProduct: 0,
        tracking: false,
        productType: "consu",
    },
    2: {
        quantity: 1,
        readOnly: false,
        price: 400,
        deliveredQty: 0,
        minimumQuantityOnProduct: 0,
        tracking: true,
        productType: "consu",
    },
    3: {
        quantity: 3,
        price: 70,
        readOnly: false,
        deliveredQty: 2,
        minimumQuantityOnProduct: 2,
        tracking: false,
        productType: "consu",
    },
};


QUnit.module('Product Catalog Stock Tests', {
    beforeEach: async function () {
        this.makeViewParams = fsmProductMakeViewParams;
        target = getFixture();
        setupViewRegistries();
    }
}, function () {
    QUnit.test('check disabling of decrease/remove buttons when quantity of product is equal to minimumQuantityOnProduct', async function (assert) {
        assert.expect(5);
        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });
        await makeView({
            ...this.makeViewParams,
            async mockRPC(route, params) {
                const { product_id, quantity } = params;
                if (route == "/product/catalog/order_lines_info") {
                    return deepCopy(stockSaleOrderLineInfo);
                }
                if (route == "/product/catalog/update_order_line_info") {
                    assert.step('update_sale_order_line_info');
                    if (product_id == 3) {
                        assert.strictEqual(quantity, 2, "Using the Remove button should set the quantity to 0 in the route params");
                    }
                    return {};
                }
            },
        });

        await click(target, '.o_kanban_record:nth-of-type(3) .o_product_catalog_quantity button:has(i.fa-minus)');
        assert.containsOnce(target,".o_kanban_record:nth-of-type(3) .o_product_catalog_quantity button:has(i.fa-minus)[disabled]", "The minus button should be disabled")
        assert.containsOnce(target,".o_kanban_record:nth-of-type(3) .o_product_catalog_buttons button:has(i.fa-trash)[disabled]", "The minus button should be disabled")
        assert.verifySteps(['update_sale_order_line_info']);
    });

    QUnit.test('check quantity not decreasable below minimumQuantityOnProduct', async function (assert) {
        assert.expect(5);
        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });
        await makeView({
            ...this.makeViewParams,
            async mockRPC(route, params) {
                const { product_id, quantity } = params;
                if (route == "/product/catalog/order_lines_info") {
                    return deepCopy(stockSaleOrderLineInfo);
                }
                if (route == "/product/catalog/update_order_line_info") {
                    assert.step('update_sale_order_line_info');
                    if (product_id == 3) {
                        assert.strictEqual(quantity, 2, "Trying to set a quantity below the minimumQuantityOnProduct should result in giving minimumQuantityOnProduct value in the route params");
                    }
                    return {};
                }
            },
        });

        const thirdProductInput = target.querySelector('.o_kanban_record:nth-child(3) .o_product_catalog_quantity .o_input');
        assert.strictEqual(thirdProductInput.value, "3", "The product quantity should be equal to 3.")
        await editInput(thirdProductInput, null, '1');
        assert.strictEqual(target.querySelector(".o_kanban_record:nth-of-type(3) .o_product_catalog_quantity .o_input").value, "2", "Trying to remove a product that has a minimumQuantityOnProduct should set the value to minimuQuantityOnProduct")
        assert.verifySteps(['update_sale_order_line_info']);
    });

    QUnit.test('check fa-list display', async function (assert) {
        await makeView({
            ...this.makeViewParams,
            async mockRPC(route, params) {
                if (route == "/product/catalog/order_lines_info") {
                    return deepCopy(stockSaleOrderLineInfo);
                }
            },
        });
        assert.containsOnce(target,".o_kanban_record:nth-of-type(2) button:has(i.fa-list)", "The fa-list icon should be available")
    });
});
