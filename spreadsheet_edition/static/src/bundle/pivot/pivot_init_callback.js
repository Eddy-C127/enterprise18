/** @odoo-module **/
//@ts-check

import * as spreadsheet from "@odoo/o-spreadsheet";
import { OdooPivot } from "@spreadsheet/pivot/pivot_data_source";
import { Domain } from "@web/core/domain";
import { deepCopy } from "@web/core/utils/objects";

const uuidGenerator = new spreadsheet.helpers.UuidGenerator();
const { parseDimension } = spreadsheet.helpers;

/**
 * Asserts that the given result is successful, otherwise throws an error.
 *
 * @param {spreadsheet.DispatchResult} result
 */
function ensureSuccess(result) {
    if (!result.isSuccessful) {
        throw new Error(`Couldn't insert pivot in spreadsheet. Reasons : ${result.reasons}`);
    }
}

export function insertPivot(pivotData) {
    const fields = pivotData.metaData.fields;
    const measures = pivotData.metaData.activeMeasures.map((measure) => ({
        name: measure,
        aggregator: fields[measure]?.aggregator,
    }));
    /** @type {import("@spreadsheet").OdooPivotDefinition} */
    const pivot = deepCopy({
        type: "ODOO",
        domain: new Domain(pivotData.searchParams.domain).toJson(),
        context: pivotData.searchParams.context,
        sortedColumn: pivotData.metaData.sortedColumn,
        measures,
        model: pivotData.metaData.resModel,
        columns: pivotData.metaData.fullColGroupBys.map(parseDimension),
        rows: pivotData.metaData.fullRowGroupBys.map(parseDimension),
        name: pivotData.name,
        actionXmlId: pivotData.actionXmlId,
    });
    /**
     * @param {import("@spreadsheet").OdooSpreadsheetModel} model
     */
    return async (model) => {
        // Add an empty sheet in the case of an existing spreadsheet.
        if (!this.isEmptySpreadsheet) {
            const sheetId = uuidGenerator.uuidv4();
            const sheetIdFrom = model.getters.getActiveSheetId();
            model.dispatch("CREATE_SHEET", {
                sheetId,
                position: model.getters.getSheetIds().length,
            });
            model.dispatch("ACTIVATE_SHEET", { sheetIdFrom, sheetIdTo: sheetId });
        }

        const pivotId = uuidGenerator.uuidv4();
        ensureSuccess(
            model.dispatch("ADD_PIVOT", {
                pivotId,
                pivot,
            })
        );

        const ds = model.getters.getPivot(pivotId);
        if (!(ds instanceof OdooPivot)) {
            throw new Error("The pivot data source is not an OdooPivot");
        }
        await ds.load();
        const table = ds.getTableStructure().export();
        const sheetId = model.getters.getActiveSheetId();

        ensureSuccess(
            model.dispatch("INSERT_PIVOT", {
                sheetId,
                col: 0,
                row: 0,
                pivotId,
                table,
            })
        );

        const columns = [];
        for (let col = 0; col <= table.cols[table.cols.length - 1].length; col++) {
            columns.push(col);
        }
        model.dispatch("AUTORESIZE_COLUMNS", { sheetId, cols: columns });
    };
}
