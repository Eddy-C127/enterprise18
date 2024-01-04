/** @odoo-module */

import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";
import { patch } from "@web/core/utils/patch";

patch(PosOrderline.prototype, {
    export_for_printing() {
        var json = super.export_for_printing(...arguments);

        var to_return = Object.assign(json, {
            product_type: this.get_product().type,
        });
        return to_return;
    },
    getDisplayData() {
        if (!this.order_id.useBlackBoxSweden()) {
            return super.getDisplayData(...arguments);
        }
        return {
            ...super.getDisplayData(...arguments),
            taxLetter: this.product.taxes_id[0]?.sweden_identification_letter,
        };
    },
});
