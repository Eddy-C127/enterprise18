/** @odoo-module */

import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { patch } from "@web/core/utils/patch";

patch(PosOrder.prototype, {
    setup() {
        super.setup(...arguments);
        this.uiState.noteHistory = {};
    },
    setCustomerCount(count) {
        super.setCustomerCount(count);
        this.pos.addPendingOrder([this.id]);
    },
});
