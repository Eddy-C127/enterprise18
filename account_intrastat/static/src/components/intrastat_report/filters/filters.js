/** @odoo-module */

import { AccountReport } from "@account_reports/components/account_report/account_report";
import { AccountReportFilters } from "@account_reports/components/account_report/filters/filters";

export class IntrastatReportFilters extends AccountReportFilters {
    static template = "account_intrastat.IntrastatReportFilters";

    //------------------------------------------------------------------------------------------------------------------
    // Getters
    //------------------------------------------------------------------------------------------------------------------
    get intrastatTypeName() {
        let name = null;

        for (const intrastatType of this.controller.options.intrastat_type)
            if (intrastatType.selected)
                name = (name) ? `${ name }, ${ intrastatType.name }` : intrastatType.name;

        return (name) ? name : "All";
    }

    get intrastatTypes() {
        return this.controller.options.intrastat_type.map((intrastatType, i) => ({
            class: { 'selected': intrastatType.selected },
            onSelected: () => this.toggleFilter('intrastat_type.' + i + '.selected'),
            label: intrastatType.name,
        }));
    }
}

AccountReport.registerCustomComponent(IntrastatReportFilters);
