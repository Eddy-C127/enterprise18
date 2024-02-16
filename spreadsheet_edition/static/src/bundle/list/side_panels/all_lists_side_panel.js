/** @odoo-module */

import { Component } from "@odoo/owl";

export class AllListsSidePanel extends Component {
    static template = "spreadsheet_edition.AllListsSidePanel";
    static components = {};
    static props = { onCloseSidePanel: Function };

    selectList(listId) {
        this.env.openSidePanel("LIST_PROPERTIES_PANEL", { listId });
    }
}
