/** @odoo-module **/
import { stores } from "@odoo/o-spreadsheet";

import {
    createSpreadsheetWithPivot,
    insertPivotInSpreadsheet,
} from "@spreadsheet/../tests/utils/pivot";
import { getBasicPivotArch } from "@spreadsheet/../tests/utils/data";
import { makeStoreWithModel } from "@spreadsheet/../tests/utils/stores";

const { ComposerStore } = stores;

QUnit.module("spreadsheet pivot auto complete");

QUnit.test("PIVOT.VALUE.* autocomplete pivot id", async function (assert) {
    const { model } = await createSpreadsheetWithPivot();
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    await insertPivotInSpreadsheet(model, "pivot2", { arch: getBasicPivotArch() });
    for (const func of ["PIVOT", "PIVOT.HEADER", "PIVOT.VALUE"]) {
        composer.startEdition(`=${func}(`);
        const autoComplete = composer.autocompleteProvider;
        assert.deepEqual(
            autoComplete.proposals,
            [
                {
                    description: "Partner Pivot",
                    fuzzySearchKey: "1Partner Pivot",
                    htmlContent: [{ color: "#02c39a", value: "1" }],
                    text: "1",
                },
                {
                    description: "Partner Pivot",
                    fuzzySearchKey: "2Partner Pivot",
                    htmlContent: [{ color: "#02c39a", value: "2" }],
                    text: "2",
                },
            ],
            `autocomplete proposals for ${func}`
        );
        autoComplete.selectProposal(autoComplete.proposals[0].text);
        assert.strictEqual(composer.currentContent, `=${func}(1`);
        assert.strictEqual(composer.autocompleteProvider, undefined, "autocomplete closed");
        composer.cancelEdition();
    }
});

QUnit.test("do not show autocomplete if pivot id already set", async function (assert) {
    const { model } = await createSpreadsheetWithPivot();
    await insertPivotInSpreadsheet(model, "pivot2", { arch: getBasicPivotArch() });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    for (const func of ["PIVOT", "PIVOT.HEADER", "PIVOT.VALUE"]) {
        // id as a number
        composer.startEdition(`=${func}(1`);
        assert.strictEqual(composer.autocompleteProvider, undefined);
        composer.cancelEdition();

        // id as a string
        composer.startEdition(`=${func}("1"`);
        assert.strictEqual(composer.autocompleteProvider, undefined);
        composer.cancelEdition();
    }
});

QUnit.test("PIVOT.VALUE measure", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="probability" type="measure"/>
                <field name="__count" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition("=PIVOT.VALUE(1,");
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(autoComplete.proposals, [
        {
            description: "Probability",
            fuzzySearchKey: 'Probability"probability"',
            htmlContent: [{ color: "#00a82d", value: '"probability"' }],
            text: '"probability"',
        },
        {
            description: "Count",
            fuzzySearchKey: 'Count"__count"',
            htmlContent: [{ color: "#00a82d", value: '"__count"' }],
            text: '"__count"',
        },
    ]);
    autoComplete.selectProposal(autoComplete.proposals[0].text);
    assert.strictEqual(composer.currentContent, '=PIVOT.VALUE(1,"probability"');
    assert.strictEqual(composer.autocompleteProvider, undefined, "autocomplete closed");
});

QUnit.test("PIVOT.VALUE measure with the pivot id as a string", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition('=PIVOT.VALUE("1",');
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(
        autoComplete.proposals.map((p) => p.text),
        ['"probability"']
    );
});

QUnit.test("PIVOT.VALUE measure with pivot id that does not exists", async function (assert) {
    const { model } = await createSpreadsheetWithPivot();
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition(`=PIVOT.VALUE(9999,`);
    assert.strictEqual(composer.autocompleteProvider, undefined);
});

QUnit.test("PIVOT.VALUE measure without any pivot id", async function (assert) {
    const { model } = await createSpreadsheetWithPivot();
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition(`=PIVOT.VALUE(,`);
    assert.strictEqual(composer.autocompleteProvider, undefined);
});

QUnit.test("PIVOT.VALUE group with a single col group", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="product_id" type="col"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition('=PIVOT.VALUE(1,"probability",');
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(autoComplete.proposals, [
        {
            description: "Product",
            fuzzySearchKey: 'Product"product_id"',
            htmlContent: [{ color: "#00a82d", value: '"product_id"' }],
            text: '"product_id"',
        },
        {
            description: "Product (positional)",
            fuzzySearchKey: 'Product"#product_id"',
            htmlContent: [{ color: "#00a82d", value: '"#product_id"' }],
            text: '"#product_id"',
        },
    ]);
    autoComplete.selectProposal(autoComplete.proposals[0].text);
    assert.strictEqual(composer.currentContent, '=PIVOT.VALUE(1,"probability","product_id"');
    assert.strictEqual(composer.autocompleteProvider, undefined, "autocomplete closed");
});

QUnit.test("PIVOT.VALUE group with a pivot id as string", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="product_id" type="col"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition('=PIVOT.VALUE("1","probability",');
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(
        autoComplete.proposals.map((p) => p.text),
        ['"product_id"', '"#product_id"']
    );
});

QUnit.test("PIVOT.VALUE group with a single row group", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="product_id" type="row"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition('=PIVOT.VALUE(1,"probability",');
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(autoComplete.proposals, [
        {
            description: "Product",
            fuzzySearchKey: 'Product"product_id"',
            htmlContent: [{ color: "#00a82d", value: '"product_id"' }],
            text: '"product_id"',
        },
        {
            description: "Product (positional)",
            fuzzySearchKey: 'Product"#product_id"',
            htmlContent: [{ color: "#00a82d", value: '"#product_id"' }],
            text: '"#product_id"',
        },
    ]);
    autoComplete.selectProposal(autoComplete.proposals[0].text);
    assert.strictEqual(composer.currentContent, '=PIVOT.VALUE(1,"probability","product_id"');
    assert.strictEqual(composer.autocompleteProvider, undefined, "autocomplete closed");
});

QUnit.test("PIVOT.VALUE search field", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="product_id" type="col"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition('=PIVOT.VALUE(1,"probability","prod');
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(
        autoComplete.proposals.map((p) => p.text),
        ['"product_id"', '"#product_id"']
    );
});

QUnit.test("PIVOT.VALUE search field with both col and row group", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="product_id" type="col"/>
                <field name="date" type="row"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    // (notice the space after the comma)
    composer.startEdition('=PIVOT.VALUE(1,"probability", ');
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(
        autoComplete.proposals.map((p) => p.text),
        ['"product_id"', '"date"', '"#product_id"', '"#date"']
    );
});

QUnit.test(
    "PIVOT.VALUE group with row and col groups for the first group",
    async function (assert) {
        const { model } = await createSpreadsheetWithPivot({
            arch: /*xml*/ `
            <pivot>
                <field name="product_id" type="row"/>
                <field name="date" type="col"/>
                <field name="probability" type="measure"/>
            </pivot>`,
        });
        const { store: composer } = makeStoreWithModel(model, ComposerStore);
        composer.startEdition('=PIVOT.VALUE(1,"probability",');
        const autoComplete = composer.autocompleteProvider;
        assert.deepEqual(
            autoComplete.proposals.map((p) => p.text),
            ['"date"', '"product_id"', '"#date"', '"#product_id"']
        );
    }
);

QUnit.test("PIVOT.VALUE group with row and col groups for the col group", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="product_id" type="row"/>
                <field name="date" type="col"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition('=PIVOT.VALUE(1,"probability","product_id",1,');
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(
        autoComplete.proposals.map((p) => p.text),
        ['"date"', '"#date"']
    );
});

QUnit.test("PIVOT.VALUE group with two rows, on the first group", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="product_id" type="row"/>
                <field name="date" type="row"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition('=PIVOT.VALUE(1,"probability", ,1,"date", "11/2020")');
    //..................................................^ the cursor is here
    composer.changeComposerCursorSelection(29, 29);
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(
        autoComplete.proposals.map((p) => p.text),
        ['"product_id"', '"#product_id"']
    );
});

QUnit.test("PIVOT.VALUE search a positional group", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="product_id" type="col"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition('=PIVOT.VALUE(1,"probability","#pro');
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(
        autoComplete.proposals.map((p) => p.text),
        ['"#product_id"']
    );
});

QUnit.test("PIVOT.VALUE autocomplete relational field for group value", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="product_id" type="row"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition('=PIVOT.VALUE(1,"probability","product_id",');
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(autoComplete.proposals, [
        {
            description: "xphone",
            fuzzySearchKey: "37xphone",
            htmlContent: [{ color: "#02c39a", value: "37" }],
            text: "37",
        },
        {
            description: "xpad",
            fuzzySearchKey: "41xpad",
            htmlContent: [{ color: "#02c39a", value: "41" }],
            text: "41",
        },
    ]);
    autoComplete.selectProposal(autoComplete.proposals[0].text);
    assert.strictEqual(composer.currentContent, '=PIVOT.VALUE(1,"probability","product_id",37');
    assert.strictEqual(composer.autocompleteProvider, undefined, "autocomplete closed");
});

QUnit.test("PIVOT.VALUE autocomplete date field for group value", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="date" type="row" interval="month"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition('=PIVOT.VALUE(1,"probability","date",');
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(autoComplete.proposals, [
        {
            description: "April 2016",
            fuzzySearchKey: "04/2016April 2016",
            htmlContent: [{ color: "#00a82d", value: '"04/2016"' }],
            text: '"04/2016"',
        },
        {
            description: "October 2016",
            fuzzySearchKey: "10/2016October 2016",
            htmlContent: [{ color: "#00a82d", value: '"10/2016"' }],
            text: '"10/2016"',
        },
        {
            description: "December 2016",
            fuzzySearchKey: "12/2016December 2016",
            htmlContent: [
                {
                    color: "#00a82d",
                    value: '"12/2016"',
                },
            ],
            text: '"12/2016"',
        },
    ]);
    autoComplete.selectProposal(autoComplete.proposals[0].text);
    assert.strictEqual(composer.currentContent, '=PIVOT.VALUE(1,"probability","date","04/2016"');
    assert.strictEqual(composer.autocompleteProvider, undefined, "autocomplete closed");
});

QUnit.test("PIVOT.VALUE autocomplete field after a date field", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="date" type="row" interval="month"/>
                <field name="product_id" type="row"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition('=PIVOT.VALUE(1,"probability","date","11/2020",');
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(
        autoComplete.proposals.map((p) => p.text),
        ['"product_id"', '"#product_id"']
    );
});

QUnit.test("PIVOT.VALUE no autocomplete for positional group field", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="product_id" type="row"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition('=PIVOT.VALUE(1,"probability","#product_id",');
    assert.strictEqual(composer.autocompleteProvider, undefined);
});

QUnit.test("PIVOT.HEADER first field", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="product_id" type="col"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition("=PIVOT.HEADER(1,");
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(
        autoComplete.proposals.map((p) => p.text),
        ['"product_id"', '"#product_id"']
    );
    autoComplete.selectProposal(autoComplete.proposals[0].text);
    assert.strictEqual(composer.currentContent, '=PIVOT.HEADER(1,"product_id"');
    assert.strictEqual(composer.autocompleteProvider, undefined, "autocomplete closed");
});

QUnit.test("PIVOT.HEADER search field", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="product_id" type="col"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition('=PIVOT.HEADER(1,"pro');
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(
        autoComplete.proposals.map((p) => p.text),
        ['"product_id"', '"#product_id"']
    );
    autoComplete.selectProposal(autoComplete.proposals[0].text);
    assert.strictEqual(composer.currentContent, '=PIVOT.HEADER(1,"product_id"');
    assert.strictEqual(composer.autocompleteProvider, undefined, "autocomplete closed");
});

QUnit.test("PIVOT.HEADER group value", async function (assert) {
    const { model } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
            <pivot>
                <field name="product_id" type="col"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store: composer } = makeStoreWithModel(model, ComposerStore);
    composer.startEdition('=PIVOT.HEADER(1,"product_id",');
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(
        autoComplete.proposals.map((p) => p.text),
        ["37", "41"]
    );
    autoComplete.selectProposal(autoComplete.proposals[0].text);
    assert.strictEqual(composer.currentContent, '=PIVOT.HEADER(1,"product_id",37');
    assert.strictEqual(composer.autocompleteProvider, undefined, "autocomplete closed");
});
