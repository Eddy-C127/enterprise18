/** @odoo-module **/

import { TimerTimesheetGridRenderer } from "@timesheet_grid/views/timer_timesheet_grid/timer_timesheet_grid_renderer";
import { TimesheetLeaderboard } from "@sale_timesheet_enterprise/components/timesheet_leaderboard/timesheet_leaderboard";

import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";

patch(TimerTimesheetGridRenderer, {
    components: {
        ...TimerTimesheetGridRenderer.components,
        TimesheetLeaderboard,
    },
});

patch(TimerTimesheetGridRenderer.prototype, {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.companyService = useService("company");
    },

    async onWillStart() {
        super.onWillStart();
        const read = await this.orm.read(
            "res.company",
            [this.companyService.currentCompany.id],
            ["timesheet_show_rates"],
        );
        this.showRates = read[0].timesheet_show_rates;
    },
});
