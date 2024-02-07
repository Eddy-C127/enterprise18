/** @odoo-module */

import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { Order } from "@point_of_sale/app/store/models";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";

patch(Order.prototype, {
    //@Override
    pay() {
        if (this.pos.company.country_id?.code === "MX") {
            const json = this.export_as_JSON();
            const isRefund = json.lines.some((x) => x[2].refunded_orderline_id);
            if (
                (isRefund && json.lines.some((x) => x[2].price_subtotal > 0.0)) ||
                (!isRefund && json.amount_total < 0.0)
            ) {
                this.pos.dialog.add(AlertDialog, {
                    title: _t("Error"),
                    body: _t(
                        "The amount of the order must be positive for a sale and negative for a refund."
                    ),
                });
                return;
            }
        }

        return super.pay(...arguments);
    },

    //@Override
    export_as_JSON() {
        const json = super.export_as_JSON(...arguments);
        if (this.pos.company.country_id?.code === "MX" && json["to_invoice"]) {
            json["l10n_mx_edi_cfdi_to_public"] = this.l10n_mx_edi_cfdi_to_public;
            json["l10n_mx_edi_usage"] = this.l10n_mx_edi_usage;
        }
        return json;
    },
});
