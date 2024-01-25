/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, {
    async _performRPC(_route, { model, method, args }) {
        if (model === "res.company" ) {
            if (method === "get_timesheet_ranking_data") {
                return this._mockResCompanyRetrieveRankingData();
            }
            if (method === "read" && args[1].length === 1 && args[1][0] === "timesheet_show_rates") {
                return this._mockReadTimesheetShowRates();
            }
        }
        return super._performRPC(...arguments);
    },
    _mockResCompanyRetrieveRankingData() {
        return { leaderboard: [], current_employee: {} };
    },
    _mockReadTimesheetShowRates() {
        return [true];
    }
});
