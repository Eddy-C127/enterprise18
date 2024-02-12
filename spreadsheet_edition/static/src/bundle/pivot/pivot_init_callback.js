/** @odoo-module **/
//@ts-check

import * as spreadsheet from "@odoo/o-spreadsheet";
import { OdooPivot } from "@spreadsheet/pivot/pivot_data_source";
import { Domain } from "@web/core/domain";
import { deepCopy } from "@web/core/utils/objects";

const uuidGenerator = new spreadsheet.helpers.UuidGenerator();

export function insertPivot(pivotData) {
    /** @type {import("@spreadsheet").OdooPivotDefinition} */
    const definition = deepCopy({
        domain: new Domain(pivotData.searchParams.domain).toJson(),
        context: pivotData.searchParams.context,
        sortedColumn: pivotData.metaData.sortedColumn,
        measures: pivotData.metaData.activeMeasures,
        model: pivotData.metaData.resModel,
        colGroupBys: pivotData.metaData.fullColGroupBys,
        rowGroupBys: pivotData.metaData.fullRowGroupBys,
        name: pivotData.name,
    });
    /**
     * @param {import("@spreadsheet").OdooSpreadsheetModel} model
     */
    return async (model) => {
        const pivotId = model.getters.getNextPivotId();
        const dataSourceId = model.getters.getPivotDataSourceId(pivotId);
        const pivotDataSource = model.config.custom.dataSources.add(
            dataSourceId,
            OdooPivot,
            definition
        );
        pivotDataSource.injectFields(pivotData.metaData.fields);
        await model.config.custom.dataSources.load(dataSourceId);
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
        const structure = pivotDataSource.getTableStructure();
        const table = structure.export();
        const sheetId = model.getters.getActiveSheetId();

        const result = model.dispatch("INSERT_PIVOT", {
            sheetId,
            col: 0,
            row: 0,
            id: pivotId,
            payload: {
                type: "ODOO",
                table,
                definition,
            },
        });
        if (!result.isSuccessful) {
            throw new Error(`Couldn't insert pivot in spreadsheet. Reasons : ${result.reasons}`);
        }
        const columns = [];
        for (let col = 0; col <= table.cols[table.cols.length - 1].length; col++) {
            columns.push(col);
        }
        model.dispatch("AUTORESIZE_COLUMNS", { sheetId, cols: columns });
    };
}
