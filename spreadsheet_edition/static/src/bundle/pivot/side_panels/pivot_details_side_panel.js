/** @odoo-module */

import { Domain } from "@web/core/domain";
import { DomainSelector } from "@web/core/domain_selector/domain_selector";
import { DomainSelectorDialog } from "@web/core/domain_selector_dialog/domain_selector_dialog";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { components, helpers, stores, hooks } from "@odoo/o-spreadsheet";
import { Component, onWillStart, onWillUpdateProps } from "@odoo/owl";

const uuidGenerator = new helpers.UuidGenerator();
const { Checkbox, Section, ValidationMessages, PivotDimensions, EditableName } = components;
const { useHighlights } = hooks;
const { useLocalStore, PivotSidePanelStore } = stores;
const { getPivotHighlights } = helpers;

export class PivotDetailsSidePanel extends Component {
    static template = "spreadsheet_edition.PivotDetailsSidePanel";
    static components = {
        DomainSelector,
        EditableName,
        ValidationMessages,
        PivotDimensions,
        Checkbox,
        Section,
    };
    static props = {
        onCloseSidePanel: Function,
        pivotId: String,
    };

    setup() {
        this.dialog = useService("dialog");
        this.notification = useService("notification");
        /**@type {PivotSidePanelStore} */
        this.store = useLocalStore(PivotSidePanelStore, this.props.pivotId);

        const loadData = async () => {
            await this.pivot.load();
            this.modelDisplayName = await this.pivot.getModelLabel();
        };
        onWillStart(loadData);
        onWillUpdateProps(loadData);
        useHighlights(this);
    }

    /** @returns {import("@spreadsheet/pivot/pivot_data_source").default} */
    get pivot() {
        return this.store.pivot;
    }

    onNameChanged(name) {
        this.env.model.dispatch("RENAME_PIVOT", {
            pivotId: this.props.pivotId,
            name,
        });
    }

    formatSort() {
        const sortedColumn = this.pivot.definition.sortedColumn;
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

    openDomainEdition() {
        const { model, domain } = this.pivot.definition;
        this.dialog.add(DomainSelectorDialog, {
            resModel: model,
            domain: domain.toString(),
            isDebugMode: !!this.env.debug,
            onConfirm: (domain) => {
                this.store.update({ domain: new Domain(domain).toJson() });
            },
        });
    }

    duplicatePivot() {
        const newPivotId = uuidGenerator.uuidv4();
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

    get deferUpdatesLabel() {
        return _t("Defer updates");
    }

    get deferUpdatesTooltip() {
        return _t(
            "Changing the pivot definition requires to reload the data. It may take some time."
        );
    }

    onDimensionsUpdated(definition) {
        this.store.update(definition);
    }

    get highlights() {
        return getPivotHighlights(this.env.model.getters, this.props.pivotId);
    }
}
