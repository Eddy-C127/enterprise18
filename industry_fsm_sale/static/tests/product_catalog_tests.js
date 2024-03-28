/** @odoo-module **/

import { mockTimeout, click, getFixture, editInput, triggerEvent, patchWithCleanup } from "@web/../tests/helpers/utils";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";
import { deepCopy } from "@web/core/utils/objects";
import { browser } from "@web/core/browser/browser";

let target;

export const saleOrderLineInfo = {
    1: {
        quantity: 0,
        readOnly: false,
        price: 14,
        productType: "consu",
    },
    2: {
        quantity: 1,
        readOnly: false,
        price: 400,
        productType: "consu",
    },
    3: {
        quantity: 3,
        price: 70,
        readOnly: false,
        productType: "consu",
    },
};

export const fsmProductMakeViewParams = {
    type: 'kanban',
    resModel: 'product.product',
    context: {
        product_catalog_order_model: "sale.order",
        fsm_task_id: 1,
    },
    serverData: {
        models: {
            'product.product': {
                fields: {
                    name: { string: "Name", type: 'string' },
                    default_code: { string: "Default Code", type: 'string' },
                },
                records: [
                    { id: 1, name: 'name1', default_code: "AAAA" },
                    { id: 2, name: 'name2', default_code: "AAAB" },
                    { id: 3, name: 'name3', default_code: "AAAC" },
                ],
            },
        },
    },
    arch: `
        <kanban
        records_draggable="0"
        js_class="fsm_product_kanban">
            <templates>
                <t t-name="kanban-box">
                    <div>
                        <field name="name"/>
                        <field name="default_code"/>
                        <div name="o_kanban_price"
                                t-attf-id="product-{{record.id.raw_value}}-price"
                                class="d-flex flex-column"/>
                    </div>
                </t>
            </templates>
        </kanban>
    `,
};

QUnit.module('Product Catalog Tests', {
    beforeEach: async function () {
        this.makeViewParams = fsmProductMakeViewParams;
        setupViewRegistries();
        target = getFixture();
    }
}, function () {
    QUnit.test('fsm_product_kanban widgets fetching data once', async function (assert) {
        assert.expect(2);
        
        await makeView({
            ...this.makeViewParams,
            async mockRPC(route, params) {
                if (route == "/product/catalog/order_lines_info") {
                    assert.step('fetch_sale_order_line_info');
                    return deepCopy(saleOrderLineInfo);
                }
            },
        });
        // checking that when the rpc call is done only once by the model before giving the data to the product records
        assert.verifySteps(['fetch_sale_order_line_info'], "The order_lines_info should be fetched only once");
    });

    QUnit.test('fsm_product_kanban widget in kanban view', async function (assert) {
        await makeView({
            ...this.makeViewParams,
            async mockRPC(route, params) {
                if (route == "/product/catalog/order_lines_info") {
                    return deepCopy(saleOrderLineInfo);
                }
            },
        });


        // Checking the total number of the Add (fa-shopping-cart), Remove (fa-trash), minus (fa-minus), plus (fa-plus) buttons, as well as the input tag
        assert.hasClass(target.getElementsByClassName('o_kanban_view'), 'o_fsm_product_kanban_view');
        assert.containsN(target, '.o_kanban_record:not(.o_kanban_ghost)', 3, "The number of kanban record should be equal to 3 records");
        assert.containsN(target, '.o_kanban_record .o_product_catalog_buttons button:has(i.fa-shopping-cart)', 1, "The number of add button should be equal to the number of kanban records without any quantity (expected 1 records)");
        assert.containsN(target, '.o_kanban_record .o_product_catalog_buttons button:has(i.fa-trash)', 2, "The number of remove button should be equal to the number of kanban records with any quantity (expected 2 records)");
        assert.containsN(target, '.o_kanban_record .o_product_catalog_quantity button:has(i.fa-plus)', 2, "The number of increase button should be equal to the number of kanban records with a quantity set (expected 2 records)");
        assert.containsN(target, '.o_kanban_record .o_product_catalog_quantity button:has(i.fa-minus)', 2, "The number of decrease button should be equal to the number of kanban records with a quantity set (expected 2 records)");
        const inputs = target.querySelectorAll(".o_kanban_record .o_product_catalog_quantity .o_input");
        assert.strictEqual(inputs.length, 2, "There should be one input space per record with quantity set (expected 2 inputs)")
        assert.strictEqual(inputs[0].value, "1")
        assert.strictEqual(inputs[1].value, "3")
    });

    QUnit.test('click on the remove/add_buttons to remove/add product.', async function (assert) {
        assert.expect(17)
        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        await makeView({
            ...this.makeViewParams,
            async mockRPC(route, params) {
                const { product_id, quantity } = params;
                if (route == "/product/catalog/order_lines_info") {
                    return deepCopy(saleOrderLineInfo);
                }
                if (route == "/product/catalog/update_order_line_info") {
                    assert.step('update_sale_order_line_info');
                    if (product_id == 1) {
                        assert.strictEqual(quantity, 1, "Using the Add button should set the quantity to 1 in the route params");
                    }
                    if (product_id == 3) {
                        assert.strictEqual(quantity, 0, "Using the Remove button should set the quantity to 0 in the route params");
                    }
                    return {};
                }
            },
        });

        assert.containsN(target, '.o_kanban_record:not(.o_kanban_ghost)', 3, "The number of kanban record should be equal to 3 records");

        // Checking the apparition/disparition of the Add (fa-shopping-cart), Remove (fa-trash), minus (fa-minus), plus (fa-plus) buttons, as well as the input tag
        // when adding a quantity
        assert.containsNone(target, '.o_kanban_record:nth-of-type(1) .o_product_catalog_quantity .o_input', "Before adding a product the kanban card should not have any input");
        assert.containsNone(target, '.o_kanban_record:nth-of-type(1) .o_product_catalog_quantity button:has(i.fa-plus)', "Before adding a product the kanban card should not have any plus button");
        assert.containsNone(target, '.o_kanban_record:nth-of-type(1) .o_product_catalog_quantity button:has(i.fa-minus)', "Before adding a product the kanban card should not have any minus button");
        await click(target, '.o_kanban_record:nth-of-type(1) .o_product_catalog_buttons button:has(i.fa-shopping-cart)');
        assert.strictEqual(target.querySelector(".o_kanban_record:nth-of-type(1) .o_product_catalog_quantity .o_input").value, "1", "Using the Add button should set the quantity to 1 on the kanban card")
        assert.containsOnce(target, '.o_kanban_record:nth-of-type(1) .o_product_catalog_quantity button:has(i.fa-plus)', "After adding a product the kanban card should have a plus button");
        assert.containsOnce(target, '.o_kanban_record:nth-of-type(1) .o_product_catalog_quantity button:has(i.fa-minus)', "After adding a product the kanban card should have a minus button");
        assert.containsNone(target, '.o_kanban_record .o_product_catalog_buttons button:has(i.fa-shopping-cart)', "After adding a product the Add button shouldn't be visible anymore");


        // checking the total number of add/remove buttons
        assert.containsN(target, '.o_kanban_record .o_product_catalog_buttons button:has(i.fa-shopping-cart)', 0, "The number of add button should be equal to the number of kanban records without any quantity (no record expected)");
        assert.containsN(target, '.o_kanban_record .o_product_catalog_buttons button:has(i.fa-trash)', 3, "The number of increase button should be equal to the number of kanban records with a quantity set (expected 3 records)");


        // Checking the total number of add/remove buttons
        // when removing a product
        await click(target, '.o_kanban_record:nth-of-type(3) .o_product_catalog_buttons button:has(i.fa-trash)');
        assert.containsN(target, '.o_kanban_record .o_product_catalog_buttons button:has(i.fa-shopping-cart)', 1, "The number of add button should be equal to the number of kanban records without any quantity (expected 1 records)");
        assert.containsN(target, '.o_kanban_record .o_product_catalog_buttons button:has(i.fa-trash)', 2, "The number of increase button should be equal to the number of kanban records with a quantity set (expected 2 records)");

        assert.verifySteps(['update_sale_order_line_info', 'update_sale_order_line_info']);
    });

    QUnit.test('click on the minus/plus_buttons to decrease/increase the quantity of a product.', async function (assert) {
        assert.expect(10);
        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });
        let firstPass = true;
        await makeView({
            ...this.makeViewParams,
            async mockRPC(route, params) {
                const { product_id, quantity } = params;
                if (route == "/product/catalog/order_lines_info") {
                    return deepCopy(saleOrderLineInfo);
                }
                if (route == "/product/catalog/update_order_line_info") {
                    assert.step('update_sale_order_line_info');
                    if (product_id == 2) {
                        if (firstPass) {
                            assert.strictEqual(quantity, 2, "Using the plus button should increase the quantity by 1 unit in the route params (expected 2)");
                            firstPass = false;
                        } else {
                            assert.strictEqual(quantity, 3, "Clicking on the kanban card should increase the quantity by 1 unit in the route params (expected 3)");
                        }
                    }
                    if (product_id == 3) {
                        assert.strictEqual(quantity, 2, "Using the minus button should decrease the quantity by 1 unit in the route params (expected 2)");
                    }
                    return {};
                }
            },
        });

        await click(target, '.o_kanban_record:nth-of-type(2) .o_product_catalog_quantity button:has(i.fa-plus)');
        assert.strictEqual(target.querySelector(".o_kanban_record:nth-of-type(2) .o_product_catalog_quantity .o_input").value, "2", "Using the plus button should increase the product quantity by 1 unit (expected 2)")

        await click(target, '.o_kanban_record:nth-of-type(2) .o_product_added');
        assert.strictEqual(target.querySelector(".o_kanban_record:nth-of-type(2) .o_product_catalog_quantity .o_input").value, "3", "Clicking on the kanban card should increase the product quantity by 1 unit (expected 3)")

        await click(target, '.o_kanban_record:nth-of-type(3) .o_product_catalog_quantity button:has(i.fa-minus)');
        assert.strictEqual(target.querySelector(".o_kanban_record:nth-of-type(3) .o_product_catalog_quantity .o_input").value, "2", "Clicking on the minus button should decrease the product quantity by 1 unit (expected 2)")

        assert.verifySteps(['update_sale_order_line_info', 'update_sale_order_line_info', 'update_sale_order_line_info']);

    });

    QUnit.test('check the debounce delay', async function (assert) {
        assert.expect(6);
        const { advanceTime } = mockTimeout();

        await makeView({
            ...this.makeViewParams,
            async mockRPC(route, params) {
                const { product_id, quantity } = params;
                if (route == "/product/catalog/order_lines_info") {
                    return deepCopy(saleOrderLineInfo);
                }
                if (route == "/product/catalog/update_order_line_info") {
                    assert.step('update_sale_order_line_info');
                    assert.strictEqual(quantity, 4, "The rpc should be only once, 500ms after the third click");
                    assert.strictEqual(product_id, 2);
                    return { price: 100 };
                }
            },
        });

        assert.containsN(target, '.o_kanban_record:not(.o_kanban_ghost)', 3, "The number of kanban record should be equal to 3 records");
        await click(target, '.o_kanban_record:nth-of-type(2) .o_product_catalog_quantity button:has(i.fa-plus)');
        await advanceTime(100); // click again before the debounce takes effect
        await click(target, '.o_kanban_record:nth-of-type(2) .o_product_catalog_quantity button:has(i.fa-plus)');
        await advanceTime(100); // click again before the debounce takes effect
        await click(target, '.o_kanban_record:nth-of-type(2) .o_product_catalog_quantity button:has(i.fa-plus)');
        await advanceTime(510); // wait until the debounce takes effect

        assert.strictEqual(target.querySelector(".o_kanban_record:nth-of-type(2) .o_product_catalog_quantity .o_input").value, "4")
        assert.verifySteps(['update_sale_order_line_info'], "The update_sale_order_line_info route should only be called once even when 3 clicks were made on the add quantity button");
    });

    QUnit.test('edit manually the product quantity and check Unit price update', async function (assert) {
        assert.expect(8);
        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        await makeView({
            ...this.makeViewParams,
            async mockRPC(route, params) {
                const { product_id, quantity } = params;
                if (route == "/product/catalog/order_lines_info") {
                    return deepCopy(saleOrderLineInfo);
                }
                if (route == "/product/catalog/update_order_line_info") {
                    assert.step('update_sale_order_line_info');
                    assert.strictEqual(quantity, 12, "The quantity should be set to 12 in the route params");
                    assert.strictEqual(product_id, 2);
                    return { price: 100 };
                }
            },
        });

        // Editing the second product value to 12 units
        const secondProductInput = target.querySelector('.o_kanban_record:nth-child(2) .o_product_catalog_quantity .o_input');
        const secondProductUnitPrice = target.querySelector('.o_kanban_record:nth-child(2) div[name="o_kanban_price"] span');
        assert.strictEqual(secondProductUnitPrice.innerText, "Unit price: 400.00", "The Unit price should be equal to 400")
        assert.strictEqual(secondProductInput.value, "1", "The product quantity should be equal to 1")

        await editInput(secondProductInput, null, '12');
        await triggerEvent(secondProductInput, null, 'keydown', { key: 'Enter', which: 13 });
        assert.strictEqual(secondProductInput.value, "12", "The product quantity should be equal to 12 after the input change")
        assert.strictEqual(secondProductUnitPrice.innerText, "Unit price: 100.00", "The Unit price should be equal to 100 after the input change")

        assert.verifySteps(['update_sale_order_line_info'], "The update_sale_order_line_info route should have been called after the quantity input on the second product");
    });

    QUnit.test('edit manually a wrong product quantity', async function (assert) {
        assert.expect(11);
        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
        });

        await makeView({
            ...this.makeViewParams,
            async mockRPC(route, params) {
                const { product_id, quantity } = params;
                if (route == "/product/catalog/order_lines_info") {
                    return deepCopy(saleOrderLineInfo);
                }
                if (route == "/product/catalog/update_order_line_info") {
                    assert.step('update_sale_order_line_info');
                    if (product_id == 2) {
                        assert.strictEqual(quantity, 0, "The quantity sent to the backend should be 0 if the input is 12a");
                    }
                    if (product_id == 3) {
                        assert.strictEqual(quantity, 0, "The quantity sent to the backend should be 0 if the input is null");
                    }
                    return {};
                }
            },
        });
        const secondProductInput = target.querySelector('.o_kanban_record:nth-child(2) .o_product_catalog_quantity .o_input');
        await editInput(secondProductInput, null, '12a');
        assert.containsNone(target, '.o_kanban_record:nth-child(2) .o_product_catalog_quantity button:has(i.fa-plus)', "After inputing a forbidden value, the quantity should be set to 0 and the plus button should disapear")
        assert.containsNone(target, '.o_kanban_record:nth-child(2) .o_product_catalog_quantity button:has(i.fa-minus)', "After inputing a forbidden value, the quantity should be set to 0 and the minus button should disapear")
        assert.containsNone(target, '.o_kanban_record:nth-child(2) .o_product_catalog_quantity .o_input', "After inputing a forbidden value, the quantity should be set to 0 and the input space should disapear")

        const thirdProductInput = target.querySelector('.o_kanban_record:nth-child(3) .o_product_catalog_quantity .o_input');
        await editInput(thirdProductInput, null, '');
        assert.containsNone(target, '.o_kanban_record:nth-child(3) .o_product_catalog_quantity button:has(i.fa-plus)', "After inputing a null value, the quantity should be set to 0 and the plus button should disapear")
        assert.containsNone(target, '.o_kanban_record:nth-child(3) .o_product_catalog_quantity button:has(i.fa-minus)', "After inputing a null value, the quantity should be set to 0 and the minus button should disapear")
        assert.containsNone(target, '.o_kanban_record:nth-child(3) .o_product_catalog_quantity .o_input', "After inputing a null value, the quantity should be set to 0 and the input space should disapear")


        assert.verifySteps(['update_sale_order_line_info', 'update_sale_order_line_info']);
    });
});
