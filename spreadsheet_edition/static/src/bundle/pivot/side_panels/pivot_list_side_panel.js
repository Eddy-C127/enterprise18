/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { PivotDetailsSidePanel } from "./pivot_details_side_panel";

import { Component } from "@odoo/owl";

export class PivotSidePanel extends Component {
    static template = "spreadsheet_edition.PivotSidePanel";
    static components = { PivotDetailsSidePanel };
    static props = { onCloseSidePanel: Function, pivot: { type: String, optional: true } };

    selectPivot(pivotId) {
        this.env.model.dispatch("SELECT_PIVOT", { pivotId });
    }

    resetSelectedPivot() {
        this.env.model.dispatch("SELECT_PIVOT");
    }

    delete(pivotId) {
        this.env.askConfirmation(_t("Are you sure you want to delete this pivot?"), () => {
            this.env.model.dispatch("REMOVE_PIVOT", { pivotId });
            this.props.onCloseSidePanel();
        });
    }
}
