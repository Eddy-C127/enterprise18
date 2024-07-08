/** @odoo-module */
import { AbstractSpreadsheetAction } from "@spreadsheet_edition/bundle/actions/abstract_spreadsheet_action";
import { registry } from "@web/core/registry";
import { SpreadsheetComponent } from "@spreadsheet/actions/spreadsheet_component";

import { useSubEnv } from "@odoo/owl";
import { SpreadsheetNavbar } from "@spreadsheet_edition/bundle/components/spreadsheet_navbar/spreadsheet_navbar";

export class SpreadsheetTestAction extends AbstractSpreadsheetAction {
    static template = "test_spreadsheet_edition.SpreadsheetTestAction";
    static components = {
        SpreadsheetComponent,
        SpreadsheetNavbar,
    };
    resModel = "spreadsheet.test";
    threadField = "dummy_id";

    setup() {
        super.setup();
        useSubEnv({
            showHistory: this.showHistory.bind(this),
        });
    }
}

registry.category("actions").add("spreadsheet_test_action", SpreadsheetTestAction, { force: true });
