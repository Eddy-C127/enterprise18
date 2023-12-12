import { patch } from "@web/core/utils/patch";
import { AccountReportFilters } from "@account_reports/components/account_report/filters/filters";

patch(AccountReportFilters.prototype, {
    get hasExtraOptionsFilter() {
        return super.hasExtraOptionsFilter || "assets_groupby_account" in this.controller.options;
    },
});
