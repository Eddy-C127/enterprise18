/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, {
    async _performRPC(_route, { model, method, args, kwargs }) {
        if (model === "res.company" && method === "get_timesheet_ranking_data") {
            return this._mockResCompanyRetrieveRankingData(args);
        }
        if (model === "hr.employee" && method === "search_read" && kwargs.fields[0] === "billable_time_target") {
            return this._mockSearchReadBillableTimeTarget(args);
        }
        return super._performRPC(...arguments);
    },
    _mockResCompanyRetrieveRankingData() {
        return { leaderboard: [], current_employee: {} };
    },
    _mockSearchReadBillableTimeTarget() {
        return [{ billable_time_target: 0 }];
    },
});
