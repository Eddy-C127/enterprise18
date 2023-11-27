/** @odoo-module */

import { RefundButton } from "@point_of_sale/app/screens/product_screen/control_buttons/refund_button/refund_button";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { patch } from "@web/core/utils/patch";

patch(RefundButton.prototype, {
    _onClick() {
        if (this.pos.useBlackBoxBe() && !this.pos.checkIfUserClocked()) {
            this.pos.env.services.dialog.add(AlertDialog, {
                'title': this._t("POS error"),
                'body':  this._t("User must be clocked in."),
            });
            return;
        }
        super._onClick();
    }
});
