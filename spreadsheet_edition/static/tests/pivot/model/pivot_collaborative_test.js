/** @odoo-module */

import { nextTick } from "@web/../tests/helpers/utils";

import { getBasicServerData } from "@spreadsheet/../tests/utils/data";
import { getCellContent, getCellFormula, getCellValue } from "@spreadsheet/../tests/utils/getters";
import { setupCollaborativeEnv } from "../../utils/collaborative_helpers";
import { OdooPivot } from "@spreadsheet/pivot/pivot_data_source";
import { waitForDataLoaded } from "@spreadsheet/helpers/model";

/**
 * @typedef {import("@spreadsheet").OdooSpreadsheetModel} Model
 * @typedef {import("@spreadsheet").OdooPivotDefinition} OdooPivotDefinition
 * @typedef {import("@spreadsheet").SPTableData} SPTableData
 */

/**
 * Add a basic pivot in the current spreadsheet of model
 * @param {Model} model
 */
export async function insertPivot(model, sheetId = model.getters.getActiveSheetId()) {
    const pivotId = "PIVOT#1";
    /** @type {OdooPivotDefinition} */
    const pivot = {
        colGroupBys: ["foo"],
        rowGroupBys: ["bar"],
        measures: ["probability"],
        model: "partner",
        domain: [],
        context: {},
        name: "Partner",
        type: "ODOO",
        sortedColumn: null,
    };
    model.dispatch("ADD_PIVOT", {
        pivotId: pivotId,
        pivot,
    });
    const ds = model.getters.getPivot(pivotId);
    if (!(ds instanceof OdooPivot)) {
        throw new Error("The pivot data source is not an OdooPivot");
    }
    await ds.load();
    const table = ds.getTableStructure().export();
    model.dispatch("INSERT_PIVOT", {
        sheetId,
        col: 0,
        row: 0,
        pivotId,
        table,
    });
    const columns = [];
    for (let col = 0; col <= table.cols[table.cols.length - 1].length; col++) {
        columns.push(col);
    }
    model.dispatch("AUTORESIZE_COLUMNS", { sheetId, cols: columns });
    await waitForDataLoaded(model);
}

let alice, bob, charlie, network;

QUnit.module("spreadsheet_edition > Pivot collaborative", {
    async beforeEach() {
        const env = await setupCollaborativeEnv(getBasicServerData());
        alice = env.alice;
        bob = env.bob;
        charlie = env.charlie;
        network = env.network;
    },
});

QUnit.test("Rename a pivot", async (assert) => {
    assert.expect(1);
    await insertPivot(alice);
    alice.dispatch("RENAME_PIVOT", { pivotId: "PIVOT#1", name: "Test" });
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => user.getters.getPivotName("PIVOT#1"),
        "Test"
    );
});

QUnit.test("Add a pivot", async (assert) => {
    assert.expect(7);
    await insertPivot(alice);
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => user.getters.getPivotIds().length,
        1
    );
    const cellFormulas = {
        B1: `=ODOO.PIVOT.HEADER(1,"foo",1)`, // header col
        A3: `=ODOO.PIVOT.HEADER(1,"bar","false")`, // header row
        B2: `=ODOO.PIVOT.HEADER(1,"foo",1,"measure","probability")`, // measure
        B3: `=ODOO.PIVOT(1,"probability","bar","false","foo",1)`, // value
        F1: `=ODOO.PIVOT.HEADER(1)`, // total header rows
        A5: `=ODOO.PIVOT.HEADER(1)`, // total header cols
    };
    for (const [cellXc, formula] of Object.entries(cellFormulas)) {
        assert.spreadsheetIsSynchronized(
            [alice, bob, charlie],
            (user) => getCellContent(user, cellXc),
            formula
        );
    }
});

QUnit.test("Add a pivot in another sheet", async (assert) => {
    alice.dispatch("CREATE_SHEET", {
        sheetId: "sheetId",
        name: "Sheet",
    });
    alice.dispatch("ACTIVATE_SHEET", {
        sheetIdFrom: alice.getters.getActiveSheetId(),
        sheetIdTo: "sheetId",
    });
    insertPivot(alice, "sheetId");
    assert.spreadsheetIsSynchronized([alice, bob, charlie], (user) => user.getters.getPivotIds(), [
        "PIVOT#1",
    ]);
    // Let the evaluation and the data sources do what they need to do
    // before Bob and Charlie activate the second sheet to see the new pivot.
    await nextTick();
    bob.dispatch("ACTIVATE_SHEET", {
        sheetIdFrom: alice.getters.getActiveSheetId(),
        sheetIdTo: "sheetId",
    });
    charlie.dispatch("ACTIVATE_SHEET", {
        sheetIdFrom: alice.getters.getActiveSheetId(),
        sheetIdTo: "sheetId",
    });
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellFormula(user, "B1"),
        `=ODOO.PIVOT.HEADER(1,"foo",1)`
    );

    assert.spreadsheetIsSynchronized([alice, bob, charlie], (user) => getCellValue(user, "B4"), 11);
    assert.spreadsheetIsSynchronized([alice, bob, charlie], (user) => getCellValue(user, "B1"), 1);
});

QUnit.test("Rename and remove a pivot concurrently", async (assert) => {
    await insertPivot(alice);
    await network.concurrent(() => {
        alice.dispatch("RENAME_PIVOT", {
            pivotId: "PIVOT#1",
            name: "test",
        });
        bob.dispatch("REMOVE_PIVOT", {
            pivotId: "PIVOT#1",
        });
    });
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => user.getters.getPivotIds().length,
        0
    );
});

QUnit.test("Insert and remove a pivot concurrently", async (assert) => {
    await insertPivot(alice);
    await network.concurrent(() => {
        const table = alice.getters.getPivot("PIVOT#1").getTableStructure().export();
        alice.dispatch("INSERT_PIVOT", {
            pivotId: "PIVOT#1",
            col: 0,
            row: 0,
            sheetId: alice.getters.getActiveSheetId(),
            table,
        });
        bob.dispatch("REMOVE_PIVOT", {
            pivotId: "PIVOT#1",
        });
    });
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => user.getters.getPivotIds().length,
        0
    );
});

QUnit.test("Duplicate and remove a pivot concurrently", async (assert) => {
    await insertPivot(alice);
    await network.concurrent(() => {
        bob.dispatch("REMOVE_PIVOT", {
            pivotId: "PIVOT#1",
        });
        alice.dispatch("DUPLICATE_PIVOT", {
            pivotId: "PIVOT#1",
            newPivotId: "2",
        });
    });
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => user.getters.getPivotIds().length,
        0
    );
});
