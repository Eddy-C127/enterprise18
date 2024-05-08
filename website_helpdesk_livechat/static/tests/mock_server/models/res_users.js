import { livechatModels } from "@im_livechat/../tests/livechat_test_helpers";

export class ResUsers extends livechatModels.ResUsers {
    _init_store_data() {
        const res = super._init_store_data(...arguments);
        res.Store.helpdesk_livechat_active = true;
        return res;
    }
}
