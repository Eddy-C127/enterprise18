/** @odoo-module */

import { OdooPivot } from "@spreadsheet/pivot/pivot_data_source";
import { patch } from "@web/core/utils/patch";

patch(OdooPivot.prototype, {
    /**
     * @param {string} fieldName
     */
    getPossibleValuesForGroupBy(fieldName) {
        this._assertDataIsLoaded();
        return this._model.getPossibleValuesForGroupBy(fieldName);
    },

    async prepareForTemplateGeneration() {
        this._assertDataIsLoaded();
        await this._model.prepareForTemplateGeneration();
    },
});
