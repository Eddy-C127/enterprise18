/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { Component } from "@odoo/owl";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

class OpenBankRecWidget extends Component {
    static template = "account.OpenBankRecWidget";
    static props = {...standardFieldProps};

    setup() {
        this.action = useService("action");
    }

    async openBankRec(ev) {
        this.action.doActionButton({
            type: "object",
            resId: this.props.record.resId,
            name: "action_open_bank_reconcile_widget",
            resModel: "account.bank.statement",
        });
    }
}

registry.category("fields").add("bank_rec_widget_open", {
    component: OpenBankRecWidget,
});
