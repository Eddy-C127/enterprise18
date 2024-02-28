/** @odoo-module */

import { Model } from "@odoo/o-spreadsheet";
import { OdooDataProvider } from "@spreadsheet/data_sources/odoo_data_provider";
import { waitForDataLoaded } from "@spreadsheet/helpers/model";
import { migrate } from "@spreadsheet/o_spreadsheet/migration";

/**
 * Convert PIVOT functions from relative to absolute.
 *
 * @param {import("@web/env").OdooEnv} env
 * @param {object} data
 * @returns {Promise<object>} spreadsheetData
 */
export async function convertFromSpreadsheetTemplate(env, data, revisions) {
    const model = new Model(
        migrate(data),
        {
            custom: {
                odooDataProvider: new OdooDataProvider(env),
            },
        },
        revisions
    );
    await waitForDataLoaded(model);
    const proms = [];
    for (const pivotId of model.getters.getPivotIds()) {
        proms.push(model.getters.getPivot(pivotId).prepareForTemplateGeneration());
    }
    await Promise.all(proms);
    model.dispatch("CONVERT_PIVOT_FROM_TEMPLATE");
    return model.exportData();
}
