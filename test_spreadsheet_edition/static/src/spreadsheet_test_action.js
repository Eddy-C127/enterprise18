/** @odoo-module */
import { AbstractSpreadsheetAction } from "@spreadsheet_edition/bundle/actions/abstract_spreadsheet_action";
import { registry } from "@web/core/registry";
import { SpreadsheetComponent } from "@spreadsheet/actions/spreadsheet_component";
import { SpreadsheetControlPanel } from "@spreadsheet_edition/bundle/actions/control_panel/spreadsheet_control_panel";

import { useSubEnv } from "@odoo/owl";

export class SpreadsheetTestAction extends AbstractSpreadsheetAction {
    static template = "test_spreadsheet_edition.SpreadsheetTestAction";
    static components = {
        SpreadsheetControlPanel,
        SpreadsheetComponent,
    };
    resModel = "spreadsheet.test";

    setup() {
        super.setup();
        useSubEnv({
            showHistory: this.showHistory.bind(this),
        });
    }
}

registry.category("actions").add("spreadsheet_test_action", SpreadsheetTestAction, { force: true });
