/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { FloorScreen } from "@pos_restaurant/app/floor_screen/floor_screen";
import { useSubEnv } from "@odoo/owl";

patch(FloorScreen.prototype, {
    setup() {
        super.setup(...arguments);
        useSubEnv({ position: {} });
    },
    async _createTableHelper() {
        const table = await super._createTableHelper(...arguments);
        const appointmentRessource = this.pos.models["appointment.resource"].get(
            table.appointment_resource_id?.id
        );

        if (!appointmentRessource) {
            await this.pos.data.searchRead(
                "appointment.resource",
                [["pos_table_ids", "in", table.id]],
                this.pos.data.fields["appointment.resource"],
                { limit: 1 }
            );
        }

        return table;
    },
    async duplicateTableOrFloor() {
        await super.duplicateTableOrFloor(...arguments);
        if (this.selectedTables.length == 0) {
            const tableWoAppointment = [];

            for (const table of this.activeTables) {
                const appointmentRessource = this.pos.models["appointment.resource"].get(
                    table.appointment_resource_id?.id
                );

                if (!appointmentRessource) {
                    tableWoAppointment.push(table.id);
                }
            }

            if (tableWoAppointment.length > 0) {
                await this.pos.data.searchRead(
                    "appointment.resource",
                    [["pos_table_ids", "in", tableWoAppointment]],
                    this.pos.data.fields["appointment.resource"]
                );
            }
        }
    },
    async createTableFromRaw(table) {
        delete table.appointment_resource_id;
        return super.createTableFromRaw(table);
    },
});
