import { helpers } from "@odoo/o-spreadsheet";
import { start } from "@mail/../tests/helpers/test_utils";
import { createSpreadsheetTestAction } from "../utils/helpers";

const { toCartesian } = helpers;

import { insertRecords } from "@bus/../tests/helpers/model_definitions_helpers";

QUnit.module("Action with thread id", {}, () => {
    QUnit.test("Load the action with valid thread Id", async (assert) => {
        const spreadsheetId = 1;
        const threadId = 1;
        const workbookdata = {
            sheets: [{ comments: { Z100: [{ threadId, isResolved: false }] } }],
        };
        insertRecords("spreadsheet.test", [
            {
                name: "Untitled Dummy Spreadsheet",
                spreadsheet_data: JSON.stringify(workbookdata),
                id: spreadsheetId,
            },
        ]);
        insertRecords("spreadsheet.cell.thread", [{ id: threadId, dummy_id: spreadsheetId }]);
        const { webClient } = await start();
        const { model } = await createSpreadsheetTestAction("spreadsheet_test_action", {
            webClient,
            spreadsheetId,
            threadId,
        });
        const sheetId = model.getters.getActiveSheetId();
        assert.deepEqual(model.getters.getActivePosition(), { sheetId, ...toCartesian("Z100") });
    });

    QUnit.test("Load the action with invalid thread Id", async (assert) => {
        const spreadsheetId = 1;
        const threadId = 1;
        const workbookdata = { sheets: [{ comments: { Z100: [threadId] } }] };
        insertRecords("spreadsheet.test", [
            {
                name: "Untitled Dummy Spreadsheet",
                spreadsheet_data: JSON.stringify(workbookdata),
                id: spreadsheetId,
            },
        ]);
        insertRecords("spreadsheet.cell.thread", [{ id: threadId, dummy_id: spreadsheetId }]);
        const { webClient } = await start();
        const { model } = await createSpreadsheetTestAction("spreadsheet_test_action", {
            webClient,
            spreadsheetId,
            threadId: "invalidId",
        });
        const sheetId = model.getters.getActiveSheetId();
        assert.deepEqual(model.getters.getActivePosition(), { sheetId, ...toCartesian("A1") });
    });
});
