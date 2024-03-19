import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { _t } from "@web/core/l10n/translation";

patch(PosStore.prototype, {
    async setup() {
        await super.setup(...arguments);
        this.onNotified("TABLE_BOOKING", (payload) => {
            const { command, event } = payload;
            if (!event) {
                return;
            }
            if (command === "ADDED") {
                this.models.loadData({ "calendar.event": [event] });
            } else if (command === "REMOVED") {
                this.models["calendar.event"].get(event.id)?.delete?.();
            }
        });
    },
    manageBookings() {
        // FIXME: it would be better to use the AppointmentBookingGanttView here
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "calendar.event",
            views: [[false, "gantt"]],
            target: "new",
            name: _t("Manage Bookings"),
            context: {
                appointment_booking_gantt_show_all_resources: true,
                active_model: "appointment.type",
                search_default_appointment_type_id: this.config.raw.appointment_type_ids[0],
            },
        });
    },
});
