/** @odoo-module **/

import { TimesheetTimerKanbanRenderer } from "@timesheet_grid/views/timesheet_kanban/timesheet_timer_kanban_renderer";
import { TimesheetLeaderboard } from "@sale_timesheet_enterprise/components/timesheet_leaderboard/timesheet_leaderboard";

import { user } from "@web/core/user";
import { patch } from "@web/core/utils/patch";
import { onWillStart } from "@odoo/owl";

patch(TimesheetTimerKanbanRenderer, {
    components: {
        ...TimesheetTimerKanbanRenderer.components,
        TimesheetLeaderboard,
    },
});

patch(TimesheetTimerKanbanRenderer.prototype, {
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
