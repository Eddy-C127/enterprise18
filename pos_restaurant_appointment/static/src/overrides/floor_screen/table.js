import { patch } from "@web/core/utils/patch";
import { Table } from "@pos_restaurant/app/floor_screen/table";
import { getMin } from "@point_of_sale/utils";
import { deserializeDateTime, serializeDateTime } from "@web/core/l10n/dates";
const { DateTime } = luxon;

patch(Table.prototype, {
    get firstAppointment() {
        const table = this.props.table;
        if (!table.appointment_resource_id) {
            return false;
        }
        const appointments = this.pos.models["calendar.event"].getAllBy("appointment_resource_ids")[
            table.appointment_resource_id.id
        ];
        if (!appointments) {
            return false;
        }
        const startOfToday = DateTime.now().set({ hours: 0, minutes: 0, seconds: 0 });
        appointments.map((appointment) => {
            if (
                deserializeDateTime(appointment.start).toFormat("yyyy-MM-dd") <
                DateTime.now().toFormat("yyyy-MM-dd")
            ) {
                appointment.start = serializeDateTime(startOfToday);
            }
        });
        const possible_appointments = appointments.filter(
            (a) => deserializeDateTime(a.start).ts > DateTime.now() - (a.duration / 2) * 3600000
        );
        if (possible_appointments.length === 0) {
            return false;
        }
        return getMin(possible_appointments, {
            criterion: (a) => deserializeDateTime(a.start).ts,
        });
    },
    getFormatedDate(date) {
        return deserializeDateTime(date).toFormat("HH:mm");
    },
    get textStyle() {
        let style = "";
        const table = this.props.table;
        const dateNow = DateTime.now();
        const dateStart = deserializeDateTime(this.firstAppointment.start).ts;
        const rgb = table.floor_id.background_color
            .substring(4, table.floor_id.background_color.length - 1)
            .replace(/ /g, "")
            .split(",");
        const light = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 > 0.5 ? false : true;
        const order = this.pos.models["pos.order"].find((o) => o.table_id === this.props.table.id);

        if (!order && dateNow > dateStart) {
            style = `color: ${light ? "#FF6767" : "#850000"};`;
        } else {
            style = `color: ${light ? "white" : "black"};`;
        }

        if (dateNow < dateStart) {
            style += `opacity: 0.7;`;
        }
        style += `z-index: 1000;`;
        return style;
    },
});
