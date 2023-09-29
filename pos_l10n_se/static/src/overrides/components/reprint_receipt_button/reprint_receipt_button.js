/** @odoo-module */

import { ReprintReceiptButton } from "@point_of_sale/app/screens/ticket_screen/reprint_receipt_button/reprint_receipt_button";
import { patch } from "@web/core/utils/patch";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";

patch(ReprintReceiptButton.prototype, {
    setup() {
        super.setup(...arguments);
        this.orm = useService("orm");
        this.dialog = useService("dialog");
    },
    async _onClick() {
        if (this.pos.useBlackBoxSweden()) {
            const order = this.props.order;

            if (order) {
                const isReprint = await this.orm.call("pos.order", "is_already_reprint", [
                    [this.pos.validated_orders_name_server_id_map[order.name]],
                ]);
                if (isReprint) {
                    this.dialog.add(AlertDialog, {
                        title: _t("POS error"),
                        body: _t("A duplicate has already been printed once."),
                    });
                } else {
                    order.receipt_type = "kopia";
                    await this.pos.push_single_order(order);
                    order.receipt_type = false;
                    order.isReprint = true;
                    await this.orm.call("pos.order", "set_is_reprint", [
                        [this.pos.validated_orders_name_server_id_map[order.name]],
                    ]);
                    return super._onClick(...arguments);
                }
            }
        } else {
            return super._onClick(...arguments);
        }
    },
});
