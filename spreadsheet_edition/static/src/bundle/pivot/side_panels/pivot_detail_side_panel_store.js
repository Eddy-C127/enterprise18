import { stores, helpers } from "@odoo/o-spreadsheet";
import { OdooPivotRuntimeDefinition } from "@spreadsheet/pivot/pivot_data_source";
import { _t } from "@web/core/l10n/translation";

const { SpreadsheetStore } = stores;
const { deepEquals, deepCopy } = helpers;

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
        const { rows, columns, measures } = this.definition;
        const currentlyUsed = measures
            .concat(rows)
            .concat(columns)
            .map((field) => field.name);
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
        const { columns, rows, measures } = this.definition;
        const currentlyUsed = measures
            .concat(rows)
            .concat(columns)
            .map((field) => field.name);
        const unusedDateTimeGranularities = this.unusedDateTimeGranularities;
        return groupableFields
            .filter((field) => {
                if (field.type === "date" || field.type === "datetime") {
                    return (
                        !currentlyUsed.includes(field.name) ||
                        unusedDateTimeGranularities[field.name].size > 0
                    );
                }
                return !currentlyUsed.includes(field.name);
            })
            .sort((a, b) => a.string.localeCompare(b.string));
    }

    get unusedDateTimeGranularities() {
        return this.getUnusedDateTimeGranularities(this.pivot.getFields(), this.definition);
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
        const definition = { ...coreDefinition, ...this.draft, ...definitionUpdate };
        // clean to make sure we only keep the core properties
        const cleanedDefinition = {
            ...definition,
            columns: definition.columns.map((col) => ({
                name: col.name,
                order: col.order,
                granularity: col.granularity,
            })),
            rows: definition.rows.map((row) => ({
                name: row.name,
                order: row.order,
                granularity: row.granularity,
            })),
            measures: definition.measures.map((measure) => ({
                name: measure.name,
                aggregator: measure.aggregator,
            })),
        };
        if (!this.draft && deepEquals(coreDefinition, cleanedDefinition)) {
            return;
        }
        const cleanedWithGranularity = this.addDefaultDateTimeGranularity(
            this.pivot.getFields(),
            cleanedDefinition
        );
        if (this.updatesAreDeferred) {
            this.draft = cleanedWithGranularity;
        } else {
            this.model.dispatch("UPDATE_PIVOT", {
                pivotId: this.pivotId,
                pivot: cleanedWithGranularity,
            });
        }
    }

    /**
     * @private
     * @param {import("@spreadsheet").Fields} fields
     * @param {OdooPivotDefinition} definition
     */
    addDefaultDateTimeGranularity(fields, definition) {
        const { columns, rows } = definition;
        const columnsWithGranularity = deepCopy(columns);
        const rowsWithGranularity = deepCopy(rows);
        const unusedGranularities = this.getUnusedDateTimeGranularities(fields, definition);
        for (const dimension of columnsWithGranularity.concat(rowsWithGranularity)) {
            const fieldType = fields[dimension.name].type;
            if ((fieldType === "date" || fieldType === "datetime") && !dimension.granularity) {
                const granularity =
                    unusedGranularities[dimension.name]?.values().next().value || "year";
                unusedGranularities[dimension.name]?.delete(granularity);
                dimension.granularity = granularity;
            }
        }
        return {
            ...definition,
            columns: columnsWithGranularity,
            rows: rowsWithGranularity,
        };
    }

    /**
     * @private
     * @param {import("@spreadsheet").Fields} fields
     * @param {OdooPivotDefinition} definition
     */
    getUnusedDateTimeGranularities(fields, definition) {
        const { columns, rows } = definition;
        const dateFields = columns.concat(rows).filter((dimension) => {
            const fieldType = fields[dimension.name].type;
            return fieldType === "date" || fieldType === "datetime";
        });
        const granularities = ["year", "quarter", "month", "week", "day"];
        const granularitiesPerFields = {};
        for (const field of dateFields) {
            granularitiesPerFields[field.name] = new Set(granularities);
        }
        for (const field of dateFields) {
            granularitiesPerFields[field.name].delete(field.granularity);
        }
        return granularitiesPerFields;
    }
}
