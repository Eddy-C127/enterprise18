/** @odoo-module */
import { Dialog } from "@web/core/dialog/dialog";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { useService } from "@web/core/utils/hooks";
import { useState, Component } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { usePos } from "@point_of_sale/app/store/pos_hook";

/**
 * Last Transaction Status Button
 *
 * Retrieve the status of the last transaction processed by the connected
 * Worldline payment terminal and opens a popup to display the result.
 */
export class LastTransactionStatusButton extends Component {
    static template = "pos_iot.LastTransactionStatusButton";

    setup() {
        this.state = useState({ pending: false });
        this.pos = usePos();
        this.dialog = useService("dialog");
    }

    sendLastTransactionStatus() {
        if (this.state.pending) {
            return;
        }

        const status = this.pos.get_order()?.selected_paymentline?.payment_status;
        if (status && ["waiting", "waitingCard", "waitingCancel"].includes(status)) {
            this.dialog.add(AlertDialog, {
                title: _t("Electronic payment in progress"),
                body: _t(
                    "You cannot check the status of the last transaction when a payment in in progress."
                ),
            });
            return;
        }

        this.state.pending = true;
        this.pos.payment_methods.map((pm) => {
            if (pm.use_payment_terminal == "worldline") {
                var terminal = pm.payment_terminal.get_terminal();
                terminal.addListener(this._onLastTransactionStatus.bind(this));
                terminal.action({ messageType: "LastTransactionStatus" }).catch(() => {
                    this.state.pending = false;
                });
            }
        });
    }

    _onLastTransactionStatus(data) {
        this.state.pending = false;
        this.dialog.add(LastTransactionPopup, data.value);
    }
}

/**
 * Last Transaction Popup
 *
 * Displays the result of the last transaction processed by the connected
 * Worldline payment terminal
 */
export class LastTransactionPopup extends Component {
    static template = "pos_iot.LastTransactionPopup";
    static components = { Dialog };
}
