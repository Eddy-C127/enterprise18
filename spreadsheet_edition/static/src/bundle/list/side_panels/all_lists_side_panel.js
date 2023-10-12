/** @odoo-module */

import { Component, onWillUpdateProps } from "@odoo/owl";

export class AllListsSidePanel extends Component {
    static template = "spreadsheet_edition.AllListsSidePanel";
    static components = {};
    static props = { onCloseSidePanel: Function };

    setup() {
        onWillUpdateProps(() => {
            if (!this.env.model.getters.getListIds().length) {
                this.props.onCloseSidePanel();
            }
        });
    }

    selectList(listId) {
        this.env.openSidePanel("LIST_PROPERTIES_PANEL", { listId });
    }
}
