import { describe, expect, test } from "@odoo/hoot";
import { createSpreadsheetTestAction } from "@test_spreadsheet_edition/../tests/helpers/helpers";
import { defineTestSpreadsheetEditionModels } from "@test_spreadsheet_edition/../tests/helpers/data";

describe.current.tags("headless");
defineTestSpreadsheetEditionModels();

test("custom colors in color picker", async function () {
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
    expect(model.getters.getCustomColors()).toEqual(["#875A7B"]);
});
