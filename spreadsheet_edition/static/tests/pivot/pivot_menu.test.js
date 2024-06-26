import { describe, expect, test } from "@odoo/hoot";
import { animationFrame } from "@odoo/hoot-mock";
import * as spreadsheet from "@odoo/o-spreadsheet";
import { addGlobalFilter, selectCell } from "@spreadsheet/../tests/helpers/commands";
import { defineSpreadsheetModels } from "@spreadsheet/../tests/helpers/data";
import { getCellContent } from "@spreadsheet/../tests/helpers/getters";
import { createSpreadsheetWithPivot } from "@spreadsheet/../tests/helpers/pivot";
import { doMenuAction } from "@spreadsheet/../tests/helpers/ui";

describe.current.tags("headless");
defineSpreadsheetModels();

const { topbarMenuRegistry } = spreadsheet.registries;

test("Re-insert a pivot with a global filter should re-insert the full pivot", async function () {
    const { model, env } = await createSpreadsheetWithPivot({
        arch: /*xml*/ `
                <pivot>
                    <field name="product_id" type="col"/>
                    <field name="name" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
    });
    await addGlobalFilter(model, {
        id: "41",
        type: "relation",
        label: "41",
        defaultValue: [41],
    });
    selectCell(model, "A6");
    const reinsertPivotPath = ["data", "insert_pivot_odoo", "reinsert_pivot", "reinsert_pivot_1"];
    await doMenuAction(topbarMenuRegistry, reinsertPivotPath, env);
    await animationFrame();
    expect(getCellContent(model, "B6")).toBe(getCellContent(model, "B1"));
});
