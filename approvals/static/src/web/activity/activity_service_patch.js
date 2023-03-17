/** @odoo-module */

import { ActivityService } from "@mail/web/activity/activity_service";

import { patch } from "@web/core/utils/patch";

patch(ActivityService.prototype, "approvals/web/activity", {
    insert(data) {
        const activity = this._super(data);
        if ("approver_id" in data && "approver_status" in data) {
            if (!data.approver_id) {
                delete activity.approval;
            } else {
                activity.approval = { id: data.approver_id, status: data.approver_status };
            }
        }
        return activity;
    },
});
