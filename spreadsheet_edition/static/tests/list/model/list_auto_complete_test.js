/** @odoo-module **/
import { stores } from "@odoo/o-spreadsheet";
import { nextTick } from "@web/../tests/helpers/utils";

import { getBasicServerData } from "@spreadsheet/../tests/utils/data";
import { createModelWithDataSource } from "@spreadsheet/../tests/utils/model";
import { makeStore, makeStoreWithModel } from "@spreadsheet/../tests/utils/stores";

import { insertListInSpreadsheet } from "@spreadsheet/../tests/utils/list";

const { ComposerStore } = stores;

QUnit.module("spreadsheet list auto complete");

QUnit.test("ODOO.LIST id", async function (assert) {
    const { store: composer, model } = await makeStore(ComposerStore);
    insertListInSpreadsheet(model, {
        model: "partner",
        columns: ["foo", "bar", "date", "product_id"],
    });
    await nextTick();
    for (const formula of ["=ODOO.LIST(", "=ODOO.LIST( ", "=ODOO.LIST.HEADER("]) {
        composer.startEdition(formula);
        const autoComplete = composer.autocompleteProvider;
        assert.deepEqual(autoComplete.proposals, [
            {
                description: "List",
                fuzzySearchKey: "1List",
                htmlContent: [{ color: "#02c39a", value: "1" }],
                text: "1",
            },
        ]);
        composer.cancelEdition();
    }
});

QUnit.test("ODOO.LIST id exact match", async function (assert) {
    const { store: composer, model } = await makeStore(ComposerStore);
    insertListInSpreadsheet(model, {
        model: "partner",
        columns: ["foo", "bar", "date", "product_id"],
    });
    await nextTick();
    composer.startEdition("=ODOO.LIST(1");
    const autoComplete = composer.autocompleteProvider;
    assert.strictEqual(autoComplete, undefined);
});

const PARTNER = {
    fields: {
        foo: {
            string: "Foo",
            type: "integer",
            store: true,
            searchable: true,
            aggregator: "sum",
        },
        bar: {
            string: "Bar",
            type: "boolean",
            store: true,
            sortable: true,
            groupable: true,
            searchable: true,
        },
        name: {
            string: "name",
            type: "char",
            store: true,
            sortable: true,
            groupable: true,
            searchable: true,
        },
    },
    records: [],
};

QUnit.test("ODOO.LIST field name", async function (assert) {
    const serverData = getBasicServerData();
    serverData.models.partner = PARTNER;
    const model = await createModelWithDataSource({
        serverData,
    });
    const { store: composer } = await makeStoreWithModel(model, ComposerStore);
    insertListInSpreadsheet(model, {
        model: "partner",
        columns: ["product_id", "bar"],
    });
    await nextTick();
    composer.startEdition("=ODOO.LIST(1,1,");
    const autoComplete = composer.autocompleteProvider;
    const allFields = ["id", "display_name", "name", "write_date", "foo", "bar"];
    assert.deepEqual(
        autoComplete.proposals.map((p) => p.text),
        allFields.map((field) => `"${field}"`),
        "all fields are proposed, quoted"
    );
    // check completely only the first one
    assert.deepEqual(autoComplete.proposals[0], {
        description: "ID",
        fuzzySearchKey: 'ID"id"',
        htmlContent: [{ color: "#00a82d", value: '"id"' }],
        text: '"id"',
    });
    autoComplete.selectProposal(autoComplete.proposals[0].text);
    assert.strictEqual(composer.currentContent, '=ODOO.LIST(1,1,"id"');
    assert.strictEqual(composer.autocompleteProvider, undefined, "autocomplete closed");
});

QUnit.test("ODOO.LIST.HEADER field name", async function (assert) {
    const serverData = getBasicServerData();
    serverData.models.partner = PARTNER;
    const model = await createModelWithDataSource({
        serverData,
    });
    const { store: composer } = await makeStoreWithModel(model, ComposerStore);
    insertListInSpreadsheet(model, {
        model: "partner",
        columns: ["product_id", "bar"],
    });
    await nextTick();
    composer.startEdition("=ODOO.LIST.HEADER(1,");
    const autoComplete = composer.autocompleteProvider;
    const allFields = ["id", "display_name", "name", "write_date", "foo", "bar"];
    assert.deepEqual(
        autoComplete.proposals.map((p) => p.text),
        allFields.map((field) => `"${field}"`),
        "all fields are proposed, quoted"
    );
});

QUnit.test("ODOO.LIST field name with invalid list id", async function (assert) {
    const { store: composer, model } = await makeStore(ComposerStore);
    insertListInSpreadsheet(model, {
        model: "partner",
        columns: ["foo", "bar", "date", "product_id"],
    });
    await nextTick();
    for (const listId of ["", "0", "42"]) {
        composer.startEdition(`=ODOO.LIST(${listId},1,`);
        const autoComplete = composer.autocompleteProvider;
        assert.strictEqual(autoComplete, undefined);
        composer.cancelEdition();
    }
});
