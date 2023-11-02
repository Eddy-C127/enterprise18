/** @odoo-module **/

import { TimesheetTimerListRenderer } from "@timesheet_grid/views/timesheet_list/timesheet_timer_list_renderer";
import { TimesheetLeaderboard } from "@sale_timesheet_enterprise/components/timesheet_leaderboard/timesheet_leaderboard";
import { timesheetLeaderboardTimerHook } from "@sale_timesheet_enterprise/hooks/timesheet_leaderboard_timer_hook"

import { onWillStart } from "@odoo/owl";
import { patch } from "@web/core/utils/patch";

patch(TimesheetTimerListRenderer, {
    components: {
        ...TimesheetTimerListRenderer.components,
        TimesheetLeaderboard,
    },
});

patch(TimesheetTimerListRenderer.prototype, {
    setup() {
        super.setup()
        const leaderboardHook = timesheetLeaderboardTimerHook();
        onWillStart(async () => {
            Object.assign(this, await leaderboardHook.getLeaderboardRendering());
        });
    },

    get isMobile() {
        return this.env.isSmall;
    },
});
