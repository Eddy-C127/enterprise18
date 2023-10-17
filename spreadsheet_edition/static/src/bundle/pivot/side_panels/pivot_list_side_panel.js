/** @odoo-module */

import { Component } from "@odoo/owl";

export class AllPivotsSidePanel extends Component {
    static template = "spreadsheet_edition.AllPivotsSidePanel";
    static components = {};
    static props = { onCloseSidePanel: Function };

    selectPivot(pivotId) {
        this.env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
    }
}
