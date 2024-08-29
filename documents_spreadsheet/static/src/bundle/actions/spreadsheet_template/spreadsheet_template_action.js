/** @odoo-module **/
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";

import { SpreadsheetComponent } from "@spreadsheet/actions/spreadsheet_component";
import { AbstractSpreadsheetAction } from "@spreadsheet_edition/bundle/actions/abstract_spreadsheet_action";
import { useSubEnv } from "@odoo/owl";
import { SpreadsheetNavbar } from "@spreadsheet_edition/bundle/components/spreadsheet_navbar/spreadsheet_navbar";

export class SpreadsheetTemplateAction extends AbstractSpreadsheetAction {
    static template = "documents_spreadsheet.SpreadsheetTemplateAction";
    static components = {
        SpreadsheetComponent,
        SpreadsheetNavbar,
    };
    resModel = "spreadsheet.template";
    threadField = "template_id";

    setup() {
        super.setup();
        this.notificationMessage = _t("New spreadsheet template created");
        useSubEnv({
            newSpreadsheet: this.createNewSpreadsheet.bind(this),
            makeCopy: this.makeCopy.bind(this),
        });
    }

    /**
     * Create a new empty spreadsheet template
     * @returns {Promise<number>} id of the newly created spreadsheet template
     */
    async createNewSpreadsheet() {
        const data = {
            name: _t("Untitled spreadsheet template"),
        };
        const id = await this.orm.create("spreadsheet.template", [data]);
        this._openSpreadsheet(id);
        return id;
    }
}

registry
    .category("actions")
    .add("action_open_template", SpreadsheetTemplateAction, { force: true });
