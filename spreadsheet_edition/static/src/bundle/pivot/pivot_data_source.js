/** @odoo-module */

import { PivotDataSource } from "@spreadsheet/pivot/pivot_data_source";
import { patch } from "@web/core/utils/patch";

patch(PivotDataSource.prototype, {
    setup() {
        super.setup();
        /**
         * Contains the domain of the values used during the evaluation of the formula =Pivot(...)
         * Is used to know if a pivot cell is missing or not
         * */

        this._usedValueDomains = new Set();
        /**
         * Contains the domain of the headers used during the evaluation of the formula =Pivot.header(...)
         * Is used to know if a pivot cell is missing or not
         * */
        this._usedHeaderDomains = new Set();
    },

    /**
     * Inject fields in the metadata of the model. This is useful when the
     * fields are already known and we want to avoid a call to the server.
     *
     * @property {Record<string, Field | undefined>} fields
     */
    injectFields(fields) {
        this._metaData.fields = fields;
    },

    async _load() {
        await super._load();
        this._usedValueDomains.clear();
        this._usedHeaderDomains.clear();
    },

    startPresenceTracking() {
        this._usedValueDomains.clear();
        this._usedHeaderDomains.clear();
        this._presenceTracking = true;
    },

    stopPresenceTracking() {
        this._presenceTracking = false;
    },

    getPivotCellValue(measure, domain) {
        if (this._presenceTracking) {
            this._usedValueDomains.add(measure + "," + domain.join());
        }
        return super.getPivotCellValue(measure, domain);
    },

    computeOdooPivotHeaderValue(domainArgs) {
        if (this._presenceTracking) {
            this._usedHeaderDomains.add(domainArgs.join());
        }
        return super.computeOdooPivotHeaderValue(domainArgs);
    },

    /**
     * @param {string[]} domain
     * @param {string} measure Field name of the measures
     * @returns {boolean}
     */
    isUsedValue(domain, measure) {
        this._assertDataIsLoaded();
        return this._usedValueDomains.has(measure + "," + domain.join());
    },

    /**
     * @param {string[]} domain
     * @returns {boolean}
     */
    isUsedHeader(domain) {
        this._assertDataIsLoaded();
        return this._usedHeaderDomains.has(domain.join());
    },
});
