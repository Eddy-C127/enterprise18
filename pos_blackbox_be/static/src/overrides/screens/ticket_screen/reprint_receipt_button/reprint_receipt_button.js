/** @odoo-module */

import { ReprintReceiptButton } from "@point_of_sale/app/screens/ticket_screen/reprint_receipt_button/reprint_receipt_button";
import { patch } from "@web/core/utils/patch";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";

patch(ReprintReceiptButton.prototype, {
    setup() {
        super.setup();
        this.popup = useService("popup");
    },
    async _onClick() {
        if (this.pos.useBlackBoxBe()) {
            await this.dialog.add(AlertDialog, {
                title: _t("Fiscal Data Module Restriction"),
                body: _t("You are not allowed to reprint a ticket when using the fiscal data module."),
            });
            return;
        }
        super._onClick();
    }
});
