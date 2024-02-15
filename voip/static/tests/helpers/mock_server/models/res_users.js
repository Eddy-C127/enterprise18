import "@mail/../tests/helpers/mock_server/models/res_users"; // ensure mail overrides are applied first

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, {
    /** @override */
    _mockResUsers__init_store_data() {
        const res = super._mockResUsers__init_store_data(...arguments);
        const getConfig = (key) =>
            this.getRecords("ir.config_parameter", [["key", "=", key]])[0].value;
        res.Store.voipConfig = {
            missedCalls: this._mockVoipCall__get_number_of_missed_calls(),
            mode: getConfig("voip.mode"),
            pbxAddress: getConfig("voip.pbx_ip"),
            webSocketUrl: getConfig("voip.wsServer"),
        };
        return res;
    },
});
