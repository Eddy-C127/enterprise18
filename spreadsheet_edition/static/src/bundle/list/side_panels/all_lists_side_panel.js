/** @odoo-module */

import { Component, useRef } from "@odoo/owl";
import { hooks } from "@odoo/o-spreadsheet";
import { getListHighlights } from "../list_highlight_helpers";
const { useHighlightsOnHover } = hooks;

class ListPreview extends Component {
    static template = "spreadsheet_edition.ListPreview";
    static props = { listId: String };

    setup() {
        const previewRef = useRef("listPreview");
        useHighlightsOnHover(previewRef, this);
    }

    selectList() {
        this.env.openSidePanel("LIST_PROPERTIES_PANEL", { listId: this.props.listId });
    }

    get highlights() {
        return getListHighlights(this.env.model.getters, this.props.listId);
    }
}

export class AllListsSidePanel extends Component {
    static template = "spreadsheet_edition.AllListsSidePanel";
    static components = { ListPreview };
    static props = { onCloseSidePanel: Function };
}
