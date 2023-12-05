/** @odoo-module **/

import { TimerTimesheetGridRenderer } from "@timesheet_grid/views/timer_timesheet_grid/timer_timesheet_grid_renderer";
import { TimesheetLeaderboard } from "@sale_timesheet_enterprise/components/timesheet_leaderboard/timesheet_leaderboard";

import { user } from "@web/core/user";
import { patch } from "@web/core/utils/patch";

patch(TimerTimesheetGridRenderer, {
    components: {
        ...TimerTimesheetGridRenderer.components,
        TimesheetLeaderboard,
    },
});

patch(TimerTimesheetGridRenderer.prototype, {
    async onWillStart() {
        super.onWillStart();
        this.userHasBillingRateGroup = await user.hasGroup("sale_timesheet_enterprise.group_timesheet_leaderboard_show_rates");
    },
});
