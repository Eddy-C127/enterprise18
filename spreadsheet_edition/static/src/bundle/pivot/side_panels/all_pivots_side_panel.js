/** @odoo-module */

import { Component, onWillUpdateProps } from "@odoo/owl";

export class AllPivotsSidePanel extends Component {
    static template = "spreadsheet_edition.AllPivotsSidePanel";
    static components = {};
    static props = { onCloseSidePanel: Function };

    setup() {
        onWillUpdateProps(() => {
            if (!this.env.model.getters.getPivotIds().length) {
                this.props.onCloseSidePanel();
            }
        });
    }

    selectPivot(pivotId) {
        this.env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
    }
}
