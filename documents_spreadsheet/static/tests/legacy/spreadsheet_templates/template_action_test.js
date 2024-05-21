/** @odoo-module */

import { getBasicServerData } from "@spreadsheet/../tests/legacy/utils/data";
import { createSpreadsheetTemplate } from "@documents_spreadsheet/../tests/legacy/spreadsheet_test_utils";
import { Model } from "@odoo/o-spreadsheet";
import { setCellContent } from "@spreadsheet/../tests/legacy/utils/commands";
import { getCellValue } from "@spreadsheet/../tests/legacy/utils/getters";

QUnit.module("documents_spreadsheet > template action", {}, () => {
    QUnit.test("open template with non Latin characters", async function (assert) {
        assert.expect(1);
        const model = new Model();
        setCellContent(model, "A1", "😃");
        const serverData = getBasicServerData();
        serverData.models["spreadsheet.template"].records = [
            {
                id: 99,
                name: "template",
                spreadsheet_data: JSON.stringify(model.exportData()),
            },
        ];
        const { model: template } = await createSpreadsheetTemplate({
            serverData,
            spreadsheetId: 99,
        });
        assert.equal(
            getCellValue(template, "A1"),
            "😃",
            "It should show the smiley as a smiley 😉"
        );
    });
});
