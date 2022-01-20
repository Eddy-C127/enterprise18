/** @odoo-module **/
import { registry } from "@web/core/registry";
import { _t } from "web.core";

import SpreadsheetComponent from "documents_spreadsheet.SpreadsheetComponent";
import { SpreadsheetControlPanel } from "../control_panel/spreadsheet_control_panel";
import { base64ToJson, jsonToBase64 } from "../../o_spreadsheet/helpers";
import { useService } from "@web/core/utils/hooks";
import { AbstractSpreadsheetAction } from "../abstract_spreadsheet_action";

const { useRef } = owl;

export class SpreadsheetTemplateAction extends AbstractSpreadsheetAction {
  setup() {
    super.setup();
    this.notificationMessage = this.env._t("New spreadsheet template created");
    this.orm = useService("orm");
    this.spreadsheetRef = useRef("spreadsheet");
  }

  _initializeWith(record) {
    this.spreadsheetData = base64ToJson(record.data);
    this.state.spreadsheetName = record.name;
    this.isReadonly = record.isReadonly;
  }

  /**
   * Fetch all the necessary data to open a spreadsheet template
   * @returns {Object}
   */
  async _fetchData() {
    return this.orm.call("spreadsheet.template", "fetch_template_data", [
      this.resId,
    ]);
  }

  /**
   * Create a new empty spreadsheet template
   * @returns {number} id of the newly created spreadsheet template
   */
  async _onNewSpreadsheet() {
    const data = {
      name: _t("Untitled spreadsheet template"),
      data: btoa("{}"),
    };
    return this.orm.create("spreadsheet.template", data);
  }

  /**
   * Save the data and thumbnail on the given template
   * @param {number} spreadsheetTemplateId
   * @param {Object} values values to save
   * @param {Object} values.data exported spreadsheet data
   * @param {string} values.thumbnail spreadsheet thumbnail
   */
  async _onSpreadsheetSaved(ev) {
    const { data, thumbnail } = ev.detail;
    await this.orm.write("spreadsheet.template", [this.resId], {
      data: jsonToBase64(data),
      thumbnail,
    });
  }

  /**
   * Save a new name for the given template
   * @param {number} spreadsheetTemplateId
   * @param {string} name
   */
  async _onSpreadSheetNameChanged(ev) {
    const { name } = ev.detail;
    this.state.spreadsheetName = name;
    this.env.config.setDisplayName(this.state.spreadsheetName);
    await this.orm.write("spreadsheet.template", [this.resId], {
      name,
    });
  }

  async _onMakeCopy(ev) {
    const { data, thumbnail } = ev.detail;
    const defaultValues = {
      data: jsonToBase64(data),
      thumbnail,
    };
    const id = await this.orm.call("spreadsheet.template", "copy", [this.resId], {
      default: defaultValues,
    });
    this._openSpreadsheet(id);
  }

}

SpreadsheetTemplateAction.template =
  "documents_spreadsheet.SpreadsheetTemplateAction";
SpreadsheetTemplateAction.components = {
  SpreadsheetComponent,
  SpreadsheetControlPanel,
};

registry
  .category("actions")
  .add("action_open_template", SpreadsheetTemplateAction, { force: true });
