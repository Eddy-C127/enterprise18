/** @odoo-module **/
import { registry } from "@web/core/registry";
import { x2ManyCommands } from "@web/core/orm_service";

import { Model } from "@odoo/o-spreadsheet";
import { UNTITLED_SPREADSHEET_NAME } from "@spreadsheet/helpers/constants";
import { AbstractSpreadsheetAction } from "@spreadsheet_edition/bundle/actions/abstract_spreadsheet_action";
import { _t } from "@web/core/l10n/translation";

import { useState, useSubEnv } from "@odoo/owl";

export class SpreadsheetAction extends AbstractSpreadsheetAction {
    static template = "documents_spreadsheet.SpreadsheetAction";
    static path = "spreadsheet";
    static displayName = _t("Spreadsheet");

    resModel = "documents.document";
    threadField = "document_id";

    setup() {
        super.setup();
        this.notificationMessage = _t("New spreadsheet created in Documents");
        this.state = useState({
            isFavorited: false,
            spreadsheetName: UNTITLED_SPREADSHEET_NAME,
        });
        this.threadId = this.params?.thread_id;
        useSubEnv({
            newSpreadsheet: this.createNewSpreadsheet.bind(this),
            makeCopy: this.makeCopy.bind(this),
            saveAsTemplate: this.saveAsTemplate.bind(this),
            onSpreadsheetShared: this.shareSpreadsheet?.bind(this),
        });
    }

    /**
     * @override
     */
    _initializeWith(data) {
        super._initializeWith(data);
        this.state.isFavorited = data.is_favorited;
    }

    /**
     * @param {OdooEvent} ev
     * @returns {Promise}
     */
    async _onSpreadSheetFavoriteToggled(ev) {
        this.state.isFavorited = !this.state.isFavorited;
        return await this.orm.call("documents.document", "toggle_favorited", [[this.resId]]);
    }

    /**
     * Create a new sheet and display it
     */
    async createNewSpreadsheet() {
        const action = await this.orm.call("documents.document", "action_open_new_spreadsheet");
        this.actionService.doAction(action, { clear_breadcrumbs: true });
    }

    onSpreadsheetLeftUpdateVals() {
        return {
            ...super.onSpreadsheetLeftUpdateVals(),
            is_multipage: this.model.getters.getSheetIds().length > 1,
        };
    }

    /**
     * @private
     * @returns {Promise}
     */
    async saveAsTemplate() {
        const model = new Model(this.model.exportData(), {
            custom: {
                env: this.env,
                odooDataProvider: this.model.config.custom.odooDataProvider,
            },
        });
        const data = model.exportData();
        const name = this.state.spreadsheetName;

        this.actionService.doAction("documents_spreadsheet.save_spreadsheet_template_action", {
            additionalContext: {
                default_template_name: _t("%s - Template", name),
                default_spreadsheet_data: JSON.stringify(data),
                default_thumbnail: this.getThumbnail(),
            },
        });
    }

    /**
     *
     * @param data
     * @param excelExport
     * @returns {Promise<string>} the url to share the spreadsheet
     */
    async shareSpreadsheet(data, excelExport) {
        const vals = {
            document_ids: [x2ManyCommands.set([this.resId])],
            folder_id: this.data.folder_id,
            type: "ids",
            spreadsheet_shares: JSON.stringify([
                {
                    document_id: this.resId,
                    spreadsheet_data: JSON.stringify(data),
                    excel_files: excelExport.files,
                },
            ]),
        };
        const url = await this.orm.call("documents.share", "action_get_share_url", [vals]);
        return url;
    }
}

registry.category("actions").add("action_open_spreadsheet", SpreadsheetAction, { force: true });
