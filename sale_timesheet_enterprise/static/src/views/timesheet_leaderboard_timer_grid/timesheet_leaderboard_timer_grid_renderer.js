/** @odoo-module **/

import { TimerTimesheetGridRenderer } from "@timesheet_grid/views/timer_timesheet_grid/timer_timesheet_grid_renderer";
import { TimesheetLeaderboard } from "@sale_timesheet_enterprise/components/timesheet_leaderboard/timesheet_leaderboard";
import { timesheetLeaderboardTimerHook } from "@sale_timesheet_enterprise/hooks/timesheet_leaderboard_timer_hook"

import { patch } from "@web/core/utils/patch";

patch(TimerTimesheetGridRenderer, {
    components: {
        ...TimerTimesheetGridRenderer.components,
        TimesheetLeaderboard,
    },
});

patch(TimerTimesheetGridRenderer.prototype, {
    setup() {
        super.setup();
        this.leaderboardHook = timesheetLeaderboardTimerHook();
    },

    async onWillStart() {
        super.onWillStart();
        Object.assign(this, await this.leaderboardHook.getLeaderboardRendering());
    },
});
