import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { AccountReportFilters } from "@account_reports/components/account_report/filters/filters";

patch(AccountReportFilters.prototype, {
    get selectedExtraOptions() {
        let selectedExtraOptionsName = super.selectedExtraOptions;

        if (this.controller.options.group_by_months) {
            const groupByMonthsName = _t("Grouped By Months");
            selectedExtraOptionsName = selectedExtraOptionsName
                ? `${selectedExtraOptionsName}, ${groupByMonthsName}`
                : groupByMonthsName;
        }

        if (
            this.controller.options.sort_by_date !== undefined &&
            this.controller.options.sort_by_date !== null
        ) {
            const sortByDateName = this.controller.options.sort_by_date
                ? _t("Sort By Date")
                : _t("Sort By Number");

            selectedExtraOptionsName = selectedExtraOptionsName
                ? `${selectedExtraOptionsName}, ${sortByDateName}`
                : sortByDateName;
        }

        return selectedExtraOptionsName;
    },

    get hasExtraOptionsFilter() {
        return (
            super.hasExtraOptionsFilter ||
            "show_payment_lines" in this.controller.options ||
            "sort_by_date" in this.controller.options ||
            "group_by_months" in this.controller.options
        );
    },
});
