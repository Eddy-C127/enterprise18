import { livechatModels } from "@im_livechat/../tests/livechat_test_helpers";
import { defineModels } from "@web/../tests/web_test_helpers";
import { HelpdeskTicket } from "@website_helpdesk_livechat/../tests/mock_server/models/helpdesk_ticket";
import { ResUsers } from "@website_helpdesk_livechat/../tests/mock_server/models/res_users";

export const websiteHelpdeskLivechatModels = { ...livechatModels, HelpdeskTicket, ResUsers };

export function defineWebsiteHelpdeskLivechatModels() {
    return defineModels(websiteHelpdeskLivechatModels);
}
