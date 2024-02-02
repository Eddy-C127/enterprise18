/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";

import { DEFAULT_LINES_NUMBER } from "@spreadsheet/helpers/constants";
import { useSpreadsheetNotificationStore } from "@spreadsheet/hooks";

import { InputDialog } from "@spreadsheet_edition/bundle/actions/input_dialog/input_dialog";

import { Spreadsheet, Model } from "@odoo/o-spreadsheet";

import { useSubEnv, Component } from "@odoo/owl";

/**
 * @typedef {Object} User
 * @property {string} User.name
 * @property {string} User.id
 */

/**
 * Component wrapping the <Spreadsheet> component from o-spreadsheet
 * to add user interactions extensions from odoo such as notifications,
 * error dialogs, etc.
 */
export class SpreadsheetComponent extends Component {
    static template = "spreadsheet_edition.SpreadsheetComponent";
    static components = { Spreadsheet };
    static props = {
        model: Model,
    };

    get model() {
        return this.props.model;
    }
    setup() {
        useSpreadsheetNotificationStore();
        this.dialog = useService("dialog");

        useSubEnv({
            getLinesNumber: this._getLinesNumber.bind(this),
        });
    }

    _getLinesNumber(callback) {
        this.dialog.add(InputDialog, {
            body: _t("Select the number of records to insert"),
            confirm: callback,
            title: _t("Re-insert list"),
            inputValue: DEFAULT_LINES_NUMBER,
            inputType: "number",
        });
    }
}
