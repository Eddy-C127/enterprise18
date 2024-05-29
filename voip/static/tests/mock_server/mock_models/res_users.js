import { fields } from "@web/../tests/web_test_helpers";
import { mailModels } from "@mail/../tests/mail_test_helpers";
import { VoipProvider } from "./voip_provider";

export class ResUsers extends mailModels.ResUsers {
    voip_provider_id = fields.Generic({
        default: () => VoipProvider._records[0].id,
    });

    /** @override */
    _init_store_data() {
        const VoipCall = this.env["voip.call"];
        const VoipProvider = this.env["voip.provider"];
        /** @type {import("mock_models").ResUsers} */
        const ResUsers = this.env["res.users"];

        const res = super._init_store_data();
        const [user] = ResUsers.search_read([["id", "=", this.env.uid]]);
        if (user) {
            const [provider] = VoipProvider.search_read([["id", "=", user.voip_provider_id[0]]]);
            res.Store.voipConfig = {
                missedCalls: VoipCall._get_number_of_missed_calls(),
                mode: provider.mode,
                pbxAddress: provider.pbx_ip || "localhost",
                webSocketUrl: provider.ws_server || "ws://localhost",
            };
        }
        return res;
    }
}
