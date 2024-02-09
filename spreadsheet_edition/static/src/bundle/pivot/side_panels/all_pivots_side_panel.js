/** @odoo-module */

import { Component, useRef } from "@odoo/owl";
import { hooks } from "@odoo/o-spreadsheet";
import { getPivotHighlights } from "../pivot_highlight_helpers";
const { useHighlightsOnHover } = hooks;

class PivotPreview extends Component {
    static template = "spreadsheet_edition.PivotPreview";
    static props = { pivotId: String };
    setup() {
        const previewRef = useRef("pivotPreview");
        useHighlightsOnHover(previewRef, this);
    }

    selectPivot() {
        this.env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId: this.props.pivotId });
    }

    get highlights() {
        return getPivotHighlights(this.env.model.getters, this.props.pivotId);
    }
}

export class AllPivotsSidePanel extends Component {
    static template = "spreadsheet_edition.AllPivotsSidePanel";
    static components = { PivotPreview };
    static props = { onCloseSidePanel: Function };
}
