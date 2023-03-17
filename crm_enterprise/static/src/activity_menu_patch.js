/* @odoo-module */

import { ActivityMenu } from "@mail/web/activity/activity_menu";
import { patch } from "@web/core/utils/patch";

import "@crm/activity_menu_patch";

patch(ActivityMenu.prototype, "crm_enterprise", {
    availableViews(group) {
        if (group.model === "crm.lead") {
            return [
                [false, "list"],
                [false, "kanban"],
                [false, "form"],
                [false, "calendar"],
                [false, "pivot"],
                [false, "cohort"],
                [false, "map"],
                [false, "activity"],
            ];
        }
        return this._super(...arguments);
    },
});
