/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosBus } from "@point_of_sale/app/bus/pos_bus_service";

patch(PosBus.prototype, {
    /**
     * @override
     */
    setup() {
        super.setup(...arguments);
        this.busService.subscribe("TABLE_BOOKING", (payload) => this.ws_syncTableBooking(payload));
    },

    ws_syncTableBooking(data) {
        const { command, event } = data;

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
    },
});
