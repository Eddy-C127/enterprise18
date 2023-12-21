/** @odoo-module **/

import { createSpreadsheetTestAction } from "./utils/helpers";

QUnit.module("spreadsheet abstract action");

QUnit.test("custom colors in color picker", async function (assert) {
    const { model } = await createSpreadsheetTestAction("spreadsheet_test_action", {
        mockRPC: async function (route, args) {
            if (args.method === "join_spreadsheet_session") {
                return {
                    data: {},
                    name: "test",
                    company_colors: ["#875A7B", "not a valid color"],
                };
            }
        },
    });
    assert.deepEqual(model.getters.getCustomColors(), ["#875A7B"]);
});
