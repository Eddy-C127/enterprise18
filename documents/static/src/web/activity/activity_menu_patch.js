/** @odoo-module */

import { ActivityMenu } from "@mail/web/activity/activity_menu";

import { patch } from "web.utils";

patch(ActivityMenu.prototype, "documents", {
    async onClickRequestDocument() {
        document.body.click(); // hack to close dropdown
        this.env.services.action.doAction("documents.action_request_form");
    },
});
