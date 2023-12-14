/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { Table } from "@pos_restaurant/app/floor_screen/table";
import { getMin } from "@point_of_sale/utils";
import { deserializeDateTime } from "@web/core/l10n/dates";
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
        return getMin(
            appointments.filter(
                (a) => deserializeDateTime(a.start).ts > DateTime.now() - (a.duration / 2) * 3600000
            ),
            {
                criterion: (a) => deserializeDateTime(a.start).ts,
            }
        );
    },
    getFormatedDate(date) {
        return deserializeDateTime(date).toFormat("HH:mm");
    },
    get textStyle() {
        let style = "";
        const table = this.props.table;
        const dateNow = DateTime.now();
        const dateStart = this.firstAppointment?.start_ts;
        const rgb = table.floor_id.background_color
            .substring(4, table.floor_id.background_color.length - 1)
            .replace(/ /g, "")
            .split(",");
        const light = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 > 0.5 ? false : true;
        const order = this.pos.orders.find((o) => o.tableId === this.props.table.id);

        if (!order && dateNow > dateStart) {
            style = `color: ${light ? "#FF6767" : "#850000"};`;
        } else {
            style = `color: ${light ? "white" : "black"};`;
        }

        if (dateNow < dateStart) {
            style += `opacity: 0.7;`;
        }
        return style;
    },
});
