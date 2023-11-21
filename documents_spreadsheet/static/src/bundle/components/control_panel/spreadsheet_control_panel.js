/** @odoo-module **/

import { SpreadsheetControlPanel } from "@spreadsheet_edition/bundle/actions/control_panel/spreadsheet_control_panel";

export class DocumentsSpreadsheetControlPanel extends SpreadsheetControlPanel {
    static template = "documents_spreadsheet.DocumentsSpreadsheetControlPanel";
    static components = {
        ...SpreadsheetControlPanel.components,
    };
    static props = {
        ...SpreadsheetControlPanel.props,
        isFavorited: {
            type: Boolean,
            optional: true,
        },
        onFavoriteToggled: {
            type: Function,
            optional: true,
        },
        onSpreadsheetShared: {
            type: Function,
            optional: true,
        },
    };
}
