/* @odoo-module */

import "@mail/../tests/helpers/mock_server/models/res_users"; // ensure mail overrides are applied first

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, {
    /**
     * @override
     */
    _mockResUsers_InitMessaging(ids) {
        const res = super._mockResUsers_InitMessaging(ids);
        res.Store.helpdesk_livechat_active = true;
        return res;
    },
});
