/** @odoo-module **/

import { TimesheetTimerListRenderer } from "@timesheet_grid/views/timesheet_list/timesheet_timer_list_renderer";
import { TimesheetLeaderboard } from "@sale_timesheet_enterprise/components/timesheet_leaderboard/timesheet_leaderboard";

import { onWillStart } from "@odoo/owl";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";

patch(TimesheetTimerListRenderer, {
    components: {
        ...TimesheetTimerListRenderer.components,
        TimesheetLeaderboard,
    },
});

patch(TimesheetTimerListRenderer.prototype, {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.companyService = useService("company");
        onWillStart(this.onWillStart);
    },

    async onWillStart() {
        const read = await this.orm.read(
            "res.company",
            [this.companyService.currentCompany.id],
            ["timesheet_show_rates"],
        );
        this.showRates = read[0].timesheet_show_rates;
    },

    get isMobile() {
        return this.env.isSmall;
    },
});
