import { mailModels } from "@mail/../tests/mail_test_helpers";
import { defineModels } from "@web/../tests/web_test_helpers";

import { MailActivity } from "./mock_server/mock_models/mail_activity";
import { ResPartner } from "./mock_server/mock_models/res_partner";
import { ResUsers } from "./mock_server/mock_models/res_users";
import { VoipCall } from "./mock_server/mock_models/voip_call";
import { VoipProvider } from "./mock_server/mock_models/voip_provider";

export function defineVoipModels() {
    return defineModels(voipModels);
}

export const voipModels = {
    ...mailModels,
    MailActivity,
    ResPartner,
    ResUsers,
    VoipCall,
    VoipProvider,
};
