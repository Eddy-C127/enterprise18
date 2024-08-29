/** @odoo-module */

import { AbstractSpreadsheetAction } from "@spreadsheet_edition/bundle/actions/abstract_spreadsheet_action";
import { registry } from "@web/core/registry";
import { SpreadsheetComponent } from "@spreadsheet/actions/spreadsheet_component";
import { _t } from "@web/core/l10n/translation";
import { CheckBox } from "@web/core/checkbox/checkbox";

import { useSubEnv } from "@odoo/owl";
import { SpreadsheetNavbar } from "@spreadsheet_edition/bundle/components/spreadsheet_navbar/spreadsheet_navbar";

export class DashboardEditAction extends AbstractSpreadsheetAction {
    static template = "spreadsheet_dashboard_edition.DashboardEditAction";
    static components = {
        CheckBox,
        SpreadsheetComponent,
        SpreadsheetNavbar,
    };

    resModel = "spreadsheet.dashboard";
    threadField = "dashboard_id";
    notificationMessage = _t("New dashboard created");

    setup() {
        super.setup();
        useSubEnv({
            makeCopy: this.makeCopy.bind(this),
            onSpreadsheetShared: this.shareSpreadsheet.bind(this),
            isDashboardPublished: () => this.record && this.record.is_published,
            toggleDashboardPublished: this.togglePublished.bind(this),
            isRecordReadonly: () => this.record && this.record.isReadonly,
        });
    }

    togglePublished(is_published) {
        this.orm.write("spreadsheet.dashboard", [this.resId], {
            is_published,
        });
    }

    async shareSpreadsheet(data, excelExport) {
        const url = await this.orm.call("spreadsheet.dashboard.share", "action_get_share_url", [
            {
                dashboard_id: this.resId,
                spreadsheet_data: JSON.stringify(data),
                excel_files: excelExport.files,
            },
        ]);
        return url;
    }
}

registry.category("actions").add("action_edit_dashboard", DashboardEditAction, { force: true });
