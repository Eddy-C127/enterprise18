/** @odoo-module */

import { AccountReport } from "@account_reports/components/account_report/account_report";
import { AccountReportFilters } from "@account_reports/components/account_report/filters/filters";

export class SalesReportFilters extends AccountReportFilters {
    static template = "account_reports.SalesReportFilters";

    //------------------------------------------------------------------------------------------------------------------
    // Getters
    //------------------------------------------------------------------------------------------------------------------
    get selectedEcTaxName() {
        const selected = [];

        for (const ecTax of this.controller.options.ec_tax_filter_selection)
            if (ecTax.selected)
                selected.push(ecTax.name.substring(0, 1));

        if (selected.length === this.controller.options.ec_tax_filter_selection.length)
            return "All";

        return selected.join(', ');
    }

    get codeItems() {
        return this.controller.options.ec_tax_filter_selection.map((ecTax, index) => ({
            class: { selected: ecTax.selected },
            onSelected: () => this.toggleFilter('ec_tax_filter_selection.' + index + '.selected'),
            label: ecTax.name,
        }));
    }
}

AccountReport.registerCustomComponent(SalesReportFilters);
