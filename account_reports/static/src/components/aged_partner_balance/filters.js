/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { WarningDialog } from "@web/core/errors/error_dialogs";
import { AccountReport } from "@account_reports/components/account_report/account_report";
import { AccountReportFilters } from "@account_reports/components/account_report/filters/filters";

export class AgedPartnerBalanceFilters extends AccountReportFilters {
    static template = "account_reports.AgedPartnerBalanceFilters";

    //------------------------------------------------------------------------------------------------------------------
    // Aging Interval
    //------------------------------------------------------------------------------------------------------------------
    async setAgingInterval(ev) {
        const agingInterval = parseInt(ev.target.value);
        if (agingInterval < 1) {
            this.dialog.add(WarningDialog, {
                title: _t("Odoo Warning"),
                message: _t("Intervals cannot be smaller than 1"),
            });
            return;
        }

        await this.filterClicked("aging_interval", agingInterval, false);
    }

}

AccountReport.registerCustomComponent(AgedPartnerBalanceFilters);
