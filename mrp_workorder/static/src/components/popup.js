/** @odoo-module **/

import { Dialog } from "@web/core/dialog/dialog";
import { Component } from "@odoo/owl";

export class SelectionPopup extends Component {
    static template = "mrp_workorder.SelectionPopup";
    static components = { Dialog };
    static props = {
        popupData: Object,
        onClosePopup: Function,
        onSelectEmployee: Function,
    };

    get title() {
        return this.props.popupData.title;
    }

    get list() {
        return this.props.popupData.list;
    }

    async cancel() {
        await this.props.onClosePopup('SelectionPopup', true);
    }

    async selectItem(id) {
        await this.props.onSelectEmployee(id);
    }
}
