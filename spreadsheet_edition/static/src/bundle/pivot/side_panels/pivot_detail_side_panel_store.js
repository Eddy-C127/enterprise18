import { stores, helpers } from "@odoo/o-spreadsheet";
import { OdooPivotRuntimeDefinition } from "@spreadsheet/pivot/pivot_data_source";
import { _t } from "@web/core/l10n/translation";

const { SpreadsheetStore } = stores;
const { deepEquals } = helpers;

const MEASURES_TYPES = ["integer", "float", "monetary"];

/**
 * @typedef {import("@spreadsheet").ExtendedAddPivotDefinition} ExtendedAddPivotDefinition
 */

export class PivotSidePanelStore extends SpreadsheetStore {
    constructor(get, pivotId) {
        super(get);
        this.pivotId = pivotId;
        this.updatesAreDeferred = true;
        /**
         * @private
         * @type {ExtendedAddPivotDefinition | null}
         **/
        this.draft = null;
    }

    get pivot() {
        return this.getters.getPivot(this.pivotId);
    }

    get definition() {
        // TODO make runtime definition constructor generic
        return this.draft
            ? new OdooPivotRuntimeDefinition(this.draft, this.pivot.getFields())
            : this.pivot.definition;
    }

    get isDirty() {
        return !!this.draft;
    }

    get unusedMeasureFields() {
        const measureFields = [
            {
                name: "__count",
                string: _t("Count"),
                type: "integer",
                aggregator: "sum",
            },
        ];
        /** @type {import("@spreadsheet").Fields} */
        const fields = this.pivot.getFields();
        for (const fieldName in fields) {
            const field = fields[fieldName];
            if (
                ((MEASURES_TYPES.includes(field.type) && field.aggregator) ||
                    field.type === "many2one") &&
                field.name !== "id" &&
                field.store
            ) {
                measureFields.push(field);
            }
        }
        const currentlyUsed = this.definition.measures.map((measure) => measure.name);
        return measureFields
            .filter((field) => !currentlyUsed.includes(field.name))
            .sort((a, b) => a.string.localeCompare(b.string));
    }

    get unusedGroupableFields() {
        const groupableFields = [];
        const fields = this.pivot.getFields();
        for (const fieldName in fields) {
            const field = fields[fieldName];
            if (field.groupable) {
                groupableFields.push(field);
            }
        }
        const { columns, rows } = this.definition;
        const currentlyUsed = columns.map((col) => col.name).concat(rows.map((row) => row.name));
        return groupableFields
            .filter((field) => !currentlyUsed.includes(field.name))
            .sort((a, b) => a.string.localeCompare(b.string));
    }

    /**
     * @param {string} pivotId
     */
    reset(pivotId) {
        this.pivotId = pivotId;
        this.updatesAreDeferred = true;
        this.draft = null;
    }

    /**
     * @param {boolean} shouldDefer
     */
    deferUpdates(shouldDefer) {
        this.updatesAreDeferred = shouldDefer;
        if (shouldDefer === false && this.draft) {
            this.applyUpdate();
        }
    }

    applyUpdate() {
        if (this.draft) {
            this.model.dispatch("UPDATE_PIVOT", {
                pivotId: this.pivotId,
                pivot: this.draft,
            });
            this.draft = null;
        }
    }

    discardPendingUpdate() {
        this.draft = null;
    }

    /**
     * @param {Partial<OdooPivotDefinition>} definition
     */
    update(definitionUpdate) {
        const coreDefinition = this.getters.getPivotDefinition(this.pivotId);
        const definition = { ...coreDefinition, ...definitionUpdate };
        if (!this.draft && deepEquals(coreDefinition, definition)) {
            return;
        }
        if (this.updatesAreDeferred) {
            this.draft = definition;
        } else {
            this.model.dispatch("UPDATE_PIVOT", {
                pivotId: this.pivotId,
                pivot: definition,
            });
        }
    }
}
