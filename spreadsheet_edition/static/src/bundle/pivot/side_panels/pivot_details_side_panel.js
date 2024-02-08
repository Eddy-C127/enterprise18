/** @odoo-module */

import { Domain } from "@web/core/domain";
import { DomainSelector } from "@web/core/domain_selector/domain_selector";
import { DomainSelectorDialog } from "@web/core/domain_selector_dialog/domain_selector_dialog";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { EditableName } from "../../o_spreadsheet/editable_name/editable_name";

import { Component, onWillStart, onWillUpdateProps } from "@odoo/owl";
import { components } from "@odoo/o-spreadsheet";
const { ValidationMessages } = components;

export class PivotDetailsSidePanel extends Component {
    static template = "spreadsheet_edition.PivotDetailsSidePanel";
    static components = { DomainSelector, EditableName, ValidationMessages };
    static props = {
        onCloseSidePanel: Function,
        pivotId: String,
    };

    setup() {
        this.dialog = useService("dialog");
        this.notification = useService("notification");
        /** @type {import("@spreadsheet/pivot/pivot_data_source").default} */
        this.pivot = undefined;
        const loadData = async (pivotId) => {
            this.pivot = this.env.model.getters.getPivot(pivotId);
            await this.pivot.load();
            this.modelDisplayName = await this.pivot.getModelLabel();
        };
        onWillStart(() => loadData(this.props.pivotId));
        onWillUpdateProps(async (nextProps) => {
            if (!this.env.model.getters.isExistingPivot(nextProps.pivotId)) {
                this.props.onCloseSidePanel();
            } else {
                await loadData(nextProps.pivotId);
            }
        });
    }

    get pivotDefinition() {
        const definition = this.pivot.definition;
        return {
            model: definition.model,
            modelDisplayName: this.modelDisplayName,
            domain: new Domain(definition.domain).toString(),
            colGroupBys: definition.columns.map((col) => col.displayName),
            rowGroupBys: definition.rows.map((row) => row.displayName),
            measures: definition.measures.map((measure) => measure.displayName),
            sortedColumn: definition.sortedColumn,
        };
    }

    onNameChanged(name) {
        this.env.model.dispatch("RENAME_ODOO_PIVOT", {
            pivotId: this.props.pivotId,
            name,
        });
    }

    formatSort() {
        const sortedColumn = this.pivotDefinition.sortedColumn;
        const order = sortedColumn.order === "asc" ? _t("ascending") : _t("descending");
        const measureDisplayName = this.pivot.getMeasure(sortedColumn.measure).displayName;
        return `${measureDisplayName} (${order})`;
    }

    /**
     * Get the last update date, formatted
     *
     * @returns {string} date formatted
     */
    getLastUpdate() {
        const lastUpdate = this.pivot.lastUpdate;
        if (lastUpdate) {
            return new Date(lastUpdate).toLocaleTimeString();
        }
        return _t("never");
    }

    /**
     * Refresh the cache of the current pivot
     *
     */
    refresh() {
        this.env.model.dispatch("REFRESH_PIVOT", { id: this.props.pivotId });
    }

    openDomainEdition() {
        const { model, domain } = this.pivot.definition;
        this.dialog.add(DomainSelectorDialog, {
            resModel: model,
            domain: new Domain(domain).toString(),
            isDebugMode: !!this.env.debug,
            onConfirm: (domain) =>
                this.env.model.dispatch("UPDATE_ODOO_PIVOT_DOMAIN", {
                    pivotId: this.props.pivotId,
                    domain: new Domain(domain).toJson(),
                }),
        });
    }

    duplicatePivot() {
        const newPivotId = this.env.model.getters.getNextPivotId();
        const result = this.env.model.dispatch("DUPLICATE_PIVOT", {
            pivotId: this.props.pivotId,
            newPivotId,
        });
        const msg = result.isSuccessful
            ? _t('Pivot duplicated. Use the "Re-insert pivot" menu item to insert it in a sheet.')
            : _t("Pivot duplication failed");
        const type = result.isSuccessful ? "success" : "danger";
        this.notification.add(msg, { sticky: false, type });
        if (result.isSuccessful) {
            this.env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId: newPivotId });
        }
    }

    goToPivotList() {
        this.env.openSidePanel("ALL_PIVOTS_PANEL");
    }

    deletePivot() {
        this.env.askConfirmation(_t("Are you sure you want to delete this pivot?"), () => {
            this.env.model.dispatch("REMOVE_PIVOT", { pivotId: this.props.pivotId });
            this.props.onCloseSidePanel();
        });
    }

    get unusedPivotWarning() {
        return _t("This pivot is not used");
    }
}
