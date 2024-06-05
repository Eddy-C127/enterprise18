/** @odoo-module */

import * as spreadsheet from "@odoo/o-spreadsheet";
import { OdooPivot } from "@spreadsheet/pivot/odoo_pivot";
import { patch } from "@web/core/utils/patch";
const { helpers } = spreadsheet;
const { formatValue } = helpers;

/**
 * @typedef {import("@odoo/o-spreadsheet").PivotDomain} PivotDomain
 */

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

    getPivotCellValueAndFormat(measure, domain) {
        if (this._presenceTracking) {
            this._usedValueDomains.add(measure + "," + JSON.stringify(domain));
        }
        return super.getPivotCellValueAndFormat(measure, domain);
    },

    getPivotMeasureValue(name, domain) {
        if (this._presenceTracking) {
            this._usedHeaderDomains.add(JSON.stringify(domain));
        }
        return super.getPivotMeasureValue(name, domain);
    },

    getPivotHeaderValueAndFormat(domain) {
        if (this._presenceTracking) {
            this._usedHeaderDomains.add(JSON.stringify(domain));
        }
        return super.getPivotHeaderValueAndFormat(domain);
    },

    /**
     * @param {string} measure Field name of the measures
     * @param {PivotDomain} domain
     * @returns {boolean}
     */
    isUsedValue(measure, domain) {
        this.assertIsValid();
        return this._usedValueDomains.has(measure + "," + JSON.stringify(domain));
    },

    /**
     * @param {PivotDomain} domain
     * @returns {boolean}
     */
    isUsedHeader(domain) {
        this.assertIsValid();
        return this._usedHeaderDomains.has(JSON.stringify(domain));
    },

    /**
     * High level method computing the formatted result of PIVOT.HEADER functions.
     *
     * @param {PivotDomain} domain
     */
    getPivotHeaderFormattedValue(domain) {
        const { value, format } = this.getPivotHeaderValueAndFormat(domain);
        if (typeof value === "string") {
            return value;
        }
        const locale = this.getters.getLocale();
        return formatValue(value, { format, locale });
    },
});
