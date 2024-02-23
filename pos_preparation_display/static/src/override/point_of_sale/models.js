/** @odoo-module **/
import { Order } from "@point_of_sale/app/store/models";
import { patch } from "@web/core/utils/patch";

patch(Order.prototype, {
    setup() {
        super.setup(...arguments);
        this.noteHistory = {};
    },
    // This function send order change to preparation display.
    // For sending changes to printer see printChanges function.
    async sendChanges(cancelled) {
        for (const note of Object.values(this.noteHistory)) {
            for (const n of note) {
                const line = this.get_orderline(n.lineId);
                n.qty = line?.get_quantity();
            }
        }

        await this.pos.sendDraftToServer();
        await this.pos.data.call("pos_preparation_display.order", "process_order", [
            this.server_id,
            cancelled,
            this.noteHistory,
        ]);

        this.noteHistory = {};
        return true;
    },
    setCustomerCount(count) {
        super.setCustomerCount(count);
        this.pos.ordersToUpdateSet.add(this);
    },
});
