/** @odoo-module */

import * as spreadsheet from "@odoo/o-spreadsheet";
const { otRegistry } = spreadsheet.registries;

otRegistry
    .addTransformation("ADD_PIVOT", ["ADD_PIVOT", "DUPLICATE_PIVOT"], transformNewPivotCommand)
    .addTransformation("ADD_PIVOT", ["INSERT_PIVOT"], (toTransform, executed) => {
        if (toTransform.id === executed.id) {
            toTransform.id = parseInt(toTransform.id, 10) + 1;
        }
        return toTransform;
    })
    .addTransformation(
        "DUPLICATE_PIVOT",
        ["ADD_PIVOT", "DUPLICATE_PIVOT"],
        transformNewPivotCommand
    )
    .addTransformation(
        "REMOVE_PIVOT",
        ["RENAME_ODOO_PIVOT", "DUPLICATE_PIVOT"],
        (toTransform, executed) => {
            if (toTransform.pivotId === executed.pivotId) {
                return undefined;
            }
            return toTransform;
        }
    )
    .addTransformation("REMOVE_PIVOT", ["INSERT_PIVOT"], (toTransform, executed) => {
        if (toTransform.id === executed.pivotId) {
            return undefined;
        }
        return toTransform;
    });

function transformNewPivotCommand(toTransform) {
    const idKey = "newPivotId" in toTransform ? "newPivotId" : "id";
    return {
        ...toTransform,
        [idKey]: (parseInt(toTransform[idKey], 10) + 1).toString(),
    };
}
