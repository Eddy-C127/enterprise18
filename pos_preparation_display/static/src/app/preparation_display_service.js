/** @odoo-module **/
import { useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { PreparationDisplay } from "@pos_preparation_display/app/models/preparation_display";
import { useService } from "@web/core/utils/hooks";

const preparationDisplayService = {
    dependencies: ["orm", "bus_service"],
    async start(env, { orm, bus_service }) {
        const datas = await orm.call(
            "pos_preparation_display.display",
            "get_preparation_display_data",
            [[odoo.preparation_display.id]],
            {}
        );

        const preparationDisplayService = await new PreparationDisplay(
            datas,
            env,
            odoo.preparation_display.id
        ).ready;

        bus_service.addChannel(`preparation_display-${odoo.preparation_display.access_token}`);
        bus_service.subscribe("load_orders", (datas) => {
            if (datas.preparation_display_id !== odoo.preparation_display.id) {
                return false;
            }
            preparationDisplayService.getOrders();
        });
        bus_service.subscribe("change_order_stage", (datas) => {
            if (datas.preparation_display_id !== odoo.preparation_display.id) {
                return false;
            }
            preparationDisplayService.wsMoveToNextStage(
                datas.order_id,
                datas.stage_id,
                datas.last_stage_change
            );
        });
        bus_service.subscribe("change_orderline_status", (datas) => {
            if (datas.preparation_display_id !== odoo.preparation_display.id) {
                return false;
            }
            preparationDisplayService.wsChangeLinesStatus(datas.status);
        });
        return preparationDisplayService;
    },
};

registry.category("services").add("preparation_display", preparationDisplayService);

/**
 *
 * @returns {ReturnType<typeof preparationDisplay.start>}
 */
export function usePreparationDisplay() {
    return useState(useService("preparation_display"));
}
