/** @odoo-module */

import { OdooPivot } from "@spreadsheet/pivot/pivot_data_source";
import { patch } from "@web/core/utils/patch";

patch(OdooPivot.prototype, {
    /**
     * @param {string} fieldName
     */
    getPossibleValuesForGroupBy(fieldName) {
        this.assertIsValid();
        return this._model.getPossibleValuesForGroupBy(fieldName);
    },

    async prepareForTemplateGeneration() {
        this.assertIsValid();
        await this._model.prepareForTemplateGeneration();
    },
});
