/** @odoo-module */

import "@point_of_sale/../tests/unit/utils";
import { registry } from "@web/core/registry";

const loadPosData = registry.category("mock_server").get("pos.session/load_data");

registry.category("mock_server").add(
    "pos.session/load_data",
    async function () {
        const res = await loadPosData.call(this, ...arguments);
        res["iot.box"] = { relations: {}, fields: {}, data: [] };
        res["iot.device"] = { relations: {}, fields: {}, data: [] };
        return res;
    },
    { force: true }
);
