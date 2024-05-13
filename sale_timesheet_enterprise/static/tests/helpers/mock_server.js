/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, {
    async _performRPC(_route, { model, method, args }) {
        if (model === "res.company" ) {
            if (method === "get_timesheet_ranking_data") {
                return this._mockResCompanyRetrieveRankingData();
            }
            if (method === "read" && args[1].length === 2 && args[1][0] === "timesheet_show_rates" && args[1][1] === "timesheet_show_leaderboard") {
                return this._mockReadTimesheetShowRatesLeaderboard();
            }
        } else if (model === "hr.employee" && method === "get_billing_rate_target") {
            return this._mockGetBillingRateTarget(args);
        }
        return super._performRPC(...arguments);
    },
    _mockResCompanyRetrieveRankingData() {
        return { leaderboard: [], current_employee: {} };
    },
    _mockReadTimesheetShowRatesLeaderboard() {
        return [true, true];
    },
    _mockGetBillingRateTarget() {
        return [{ billing_rate_target: 80 }];
    },
});
