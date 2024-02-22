/** @odoo-module */

import * as spreadsheet from "@odoo/o-spreadsheet";
const { otRegistry } = spreadsheet.registries;

otRegistry.addTransformation(
    "REMOVE_PIVOT",
    ["RENAME_PIVOT", "DUPLICATE_PIVOT", "INSERT_PIVOT"],
    (toTransform, executed) => {
        if (toTransform.pivotId === executed.pivotId) {
            return undefined;
        }
        return toTransform;
    }
);
