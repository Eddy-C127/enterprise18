/** @odoo-module **/

import { TimesheetTimerListRenderer } from "@timesheet_grid/views/timesheet_list/timesheet_timer_list_renderer";
import { TimesheetLeaderboard } from "@sale_timesheet_enterprise/components/timesheet_leaderboard/timesheet_leaderboard";

import { user } from "@web/core/user";
import { patch } from "@web/core/utils/patch";
import { onWillStart } from "@odoo/owl";

patch(TimesheetTimerListRenderer, {
    components: {
        ...TimesheetTimerListRenderer.components,
        TimesheetLeaderboard,
    },
});

patch(TimesheetTimerListRenderer.prototype, {
    setup() {
        super.setup()
        onWillStart(async () => {
            this.userHasBillingRateGroup = await user.hasGroup("sale_timesheet_enterprise.group_timesheet_leaderboard_show_rates");
        });
    },

    get isMobile() {
        return this.env.isSmall;
    },
});
