/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";

patch(PosStore.prototype, {
    async setup() {
        await super.setup(...arguments);
        this.onNotified("TABLE_BOOKING", (payload) => {
            const { command, event } = payload;
            if (command === "ADDED") {
                if (!event) {
                    return;
                }

                this.pos.models.loadData({ "calendar.event": [event] });
            } else if (command === "REMOVED") {
                const rec = this.pos.models["calendar.event"].get(event.id);

                if (!rec) {
                    return;
                }

                rec.delete();
            }
        });
    },
});
