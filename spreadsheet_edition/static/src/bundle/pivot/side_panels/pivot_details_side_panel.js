/** @odoo-module */

import { Domain } from "@web/core/domain";
import { DomainSelector } from "@web/core/domain_selector/domain_selector";
import { DomainSelectorDialog } from "@web/core/domain_selector_dialog/domain_selector_dialog";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { components, helpers, stores, hooks } from "@odoo/o-spreadsheet";
import { Component, onWillStart, onWillUpdateProps } from "@odoo/owl";
import { OdooPivotLayoutConfigurator } from "./odoo_pivot_layout_configurator/odoo_pivot_layout_configurator";

const { Checkbox, Section, ValidationMessages, PivotTitleSection, PivotDeferUpdate } = components;
const { useHighlights } = hooks;
const { useLocalStore, PivotSidePanelStore } = stores;
const { getPivotHighlights } = helpers;

export class PivotDetailsSidePanel extends Component {
    static template = "spreadsheet_edition.PivotDetailsSidePanel";
    static components = {
        DomainSelector,
        ValidationMessages,
        Checkbox,
        Section,
        OdooPivotLayoutConfigurator,
        PivotDeferUpdate,
        PivotTitleSection,
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

    /** @returns {import("@spreadsheet/pivot/odoo_pivot").default} */
    get pivot() {
        return this.store.pivot;
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

    flipAxis() {
        const { rows, columns } = this.store.definition;
        this.onDimensionsUpdated({
            rows: columns,
            columns: rows,
        });
    }
}
