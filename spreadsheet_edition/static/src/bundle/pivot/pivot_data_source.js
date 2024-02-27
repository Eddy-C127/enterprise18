/** @odoo-module */

import * as spreadsheet from "@odoo/o-spreadsheet";
import { OdooPivot } from "@spreadsheet/pivot/pivot_data_source";
import { patch } from "@web/core/utils/patch";
const { helpers } = spreadsheet;
const { formatValue } = helpers;

patch(OdooPivot.prototype, {
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

    computePivotHeaderValue(domainArgs) {
        if (this._presenceTracking) {
            this._usedHeaderDomains.add(domainArgs.join());
        }
        return super.computePivotHeaderValue(domainArgs);
    },

    /**
     * @param {string[]} domain
     * @param {string} measure Field name of the measures
     * @returns {boolean}
     */
    isUsedValue(domain, measure) {
        this.assertIsValid();
        return this._usedValueDomains.has(measure + "," + domain.join());
    },

    /**
     * @param {string[]} domain
     * @returns {boolean}
     */
    isUsedHeader(domain) {
        this.assertIsValid();
        return this._usedHeaderDomains.has(domain.join());
    },

    /**
     * High level method computing the formatted result of PIVOT.HEADER functions.
     *
     * @param {(string | number)[]} pivotArgs arguments of the function (except the first one which is the pivot id)
     */
    getPivotHeaderFormattedValue(pivotArgs) {
        const value = this.computePivotHeaderValue(pivotArgs);
        if (typeof value === "string") {
            return value;
        }
        const format = this.getPivotFieldFormat(pivotArgs.at(-2));
        const locale = this.getters.getLocale();
        return formatValue(value, { format, locale });
    },
});
