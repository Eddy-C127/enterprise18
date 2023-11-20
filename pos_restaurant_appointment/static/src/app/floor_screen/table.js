/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { Table } from "@pos_restaurant/app/floor_screen/table";
import { deserializeDateTime } from "@web/core/l10n/dates";
const { DateTime } = luxon;

patch(Table.prototype, {
    get appointments() {
        const table = this.table;
        if (!table.appointment_resource_id) {
            return [];
        }

        const appointmentsByRessourceId = this.pos.models["calendar.event"].getAllBy(
            "appointment_resource_ids"
        );

        const appointments = appointmentsByRessourceId[table.appointment_resource_id.id] || [];
        return appointments
            .filter((appointment) => {
                const dateTimeStart = deserializeDateTime(appointment.start);
                return dateTimeStart.ts > DateTime.now() - (appointment.duration / 2) * 3600000;
            })
            .sort((a, b) => {
                const startA = deserializeDateTime(a.start);
                const startB = deserializeDateTime(b.start);

                startA.ts - startB.ts;
            });
    },
    getFormatedDate(date) {
        const dateTime = deserializeDateTime(date);
        return dateTime.toFormat("HH:mm");
    },
    get textStyle() {
        let style = "";
        const table = this.table;
        const dateNow = DateTime.now();
        const dateStart = this.appointments[0]?.start_ts;
        const rgb = table.floor_id.background_color
            .substring(4, table.floor_id.background_color.length - 1)
            .replace(/ /g, "")
            .split(",");
        const light = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 > 0.5 ? false : true;
        const order = this.pos.orders.find((o) => o.tableId === this.table.id);

        if (!order && dateNow > dateStart) {
            style = `color: ${light ? "#FF6767" : "#850000"};`;
        } else {
            style = `color: ${light ? "white" : "black"};`;
        }

        if (dateNow < dateStart) {
            style += `opacity: 0.7;`;
        }

        style += `bottom: -50px;`;
        return style;
    },
    computePosition(index, nbrHorizontal, widthTable) {
        const offsetPos = this.env.position;
        const position = super.computePosition(index, nbrHorizontal, widthTable);
        const lineIdx = Math.floor(index / nbrHorizontal);

        if (offsetPos.offset === undefined) {
            offsetPos.offset = 0;
            offsetPos.offsetLine = {
                0: 0,
            };
        }

        if (this.appointments[0]) {
            offsetPos.offsetLine[lineIdx + 1] = 50 + offsetPos.offsetLine[lineIdx];
        } else if (!offsetPos.offsetLine[lineIdx + 1]) {
            offsetPos.offsetLine[lineIdx + 1] = offsetPos.offsetLine[lineIdx];
        }

        position.position_v += offsetPos.offsetLine[lineIdx];
        return position;
    },
});
