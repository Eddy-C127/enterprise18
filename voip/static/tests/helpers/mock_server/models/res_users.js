import "@mail/../tests/helpers/mock_server/models/res_users"; // ensure mail overrides are applied first

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, {
    /** @override */
    _mockResUsers__init_store_data() {
        const res = super._mockResUsers__init_store_data(...arguments);
        const [user] = this.getRecords("res.users", [["id", "=", this.pyEnv.currentUser.id]]);
        if (user) {
            const [provider] = this.getRecords("voip.provider", [
                ["id", "=", user.voip_provider_id],
            ]);
            res.Store.voipConfig = {
                missedCalls: this._mockVoipCall__get_number_of_missed_calls(),
                mode: provider.mode,
                pbxAddress: provider.pbx_ip || "localhost",
                webSocketUrl: provider.ws_server || "ws://localhost",
            };
        }
        return res;
    },
});
