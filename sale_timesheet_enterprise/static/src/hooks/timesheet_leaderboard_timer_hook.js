/** @odoo-module **/

import { user } from "@web/core/user";
import { useService } from "@web/core/utils/hooks";

export function timesheetLeaderboardTimerHook() {
    const orm = useService("orm");
    const companyService = useService("company");

    return {
        getLeaderboardRendering: async () => {
            const read = await orm.read(
                "res.company",
                [companyService.currentCompany.id],
                ["timesheet_show_rates", "timesheet_show_leaderboard"],
            );
            const billableTimeTarget = await orm.call('hr.employee', 'get_billable_time_target', [[user.userId]]);
            const showIndicators = read[0].timesheet_show_rates && billableTimeTarget[0]['billable_time_target'] > 0;
            const showLeaderboard = read[0].timesheet_show_leaderboard;

            return {
                showIndicators: showIndicators,
                showLeaderboard: showLeaderboard,
                showLeaderboardComponent: showIndicators || showLeaderboard,
            }
        },
    };
}
