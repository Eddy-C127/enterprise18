import { _t } from "@web/core/l10n/translation";
import { Component, useState } from "@odoo/owl";

import { useService } from "@web/core/utils/hooks";
import { WarningDialog } from "@web/core/errors/error_dialogs";

import { DateTimeInput } from '@web/core/datetime/datetime_input';
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { MultiRecordSelector } from "@web/core/record_selectors/multi_record_selector";

const { DateTime } = luxon;

export class AccountReportFilters extends Component {
    static template = "account_reports.AccountReportFilters";
    static props = {};
    static components = {
        DateTimeInput,
        Dropdown,
        DropdownItem,
        MultiRecordSelector,
    };

    setup() {
        this.dialog = useService("dialog");
        this.companyService = useService("company");
        this.controller = useState(this.env.controller);
        this.dirtyFilter = false;
    }

    focusInnerInput(index, items) {
        const selectedItem = items[index];
        selectedItem.el.querySelector(":scope input").focus();
    }

    //------------------------------------------------------------------------------------------------------------------
    // Getters
    //------------------------------------------------------------------------------------------------------------------
    get selectedFiscalPositionName() {
        switch (this.controller.options.fiscal_position) {
            case "domestic":
                return _t("Domestic");
            case "all":
                return _t("All");
            default:
                for (const fiscalPosition of this.controller.options.available_vat_fiscal_positions) {
                    if (fiscalPosition.id === this.controller.options.fiscal_position) {
                        return fiscalPosition.name;
                    }
                }
        }
        return _t("None");
    }

    get selectedHorizontalGroupName() {
        for (const horizontalGroup of this.controller.options.available_horizontal_groups) {
            if (horizontalGroup.id === this.controller.options.selected_horizontal_group_id) {
                return horizontalGroup.name;
            }
        }
        return _t("None");
    }

    get selectedTaxUnitName() {
        for (const taxUnit of this.controller.options.available_tax_units) {
            if (taxUnit.id === this.controller.options.tax_unit) {
                return taxUnit.name;
            }
        }
        return _t("Company Only");
    }

    get selectedVariantName() {
        for (const variant of this.controller.options.available_variants) {
            if (variant.id === this.controller.options.selected_variant_id) {
                return variant.name;
            }
        }
        return _t("None");
    }

    get selectedSectionName() {
        for (const section of this.controller.options.sections)
            if (section.id === this.controller.options.selected_section_id)
                return section.name;
    }

    get selectedAccountType() {
        let selectedAccountType = this.controller.options.account_type.filter(
            (accountType) => accountType.selected,
        );
        if (
            !selectedAccountType.length ||
            selectedAccountType.length === this.controller.options.account_type.length
        ) {
            return _t("All");
        }

        const accountTypeMappings = [
            { list: ["trade_receivable", "non_trade_receivable"], name: _t("All Receivable") },
            { list: ["trade_payable", "non_trade_payable"], name: _t("All Payable") },
            { list: ["trade_receivable", "trade_payable"], name: _t("Trade Partners") },
            { list: ["non_trade_receivable", "non_trade_payable"], name: _t("Non Trade Partners") },
        ];

        const listToDisplay = [];
        for (const mapping of accountTypeMappings) {
            if (
                mapping.list.every((accountType) =>
                    selectedAccountType.map((accountType) => accountType.id).includes(accountType),
                )
            ) {
                listToDisplay.push(mapping.name);
                // Delete already checked id
                selectedAccountType = selectedAccountType.filter(
                    (accountType) => !mapping.list.includes(accountType.id),
                );
            }
        }

        return listToDisplay
            .concat(selectedAccountType.map((accountType) => accountType.name))
            .join(", ");
    }

    get selectedAmlIrFilters() {
        const selectedFilters = this.controller.options.aml_ir_filters.filter(
            (irFilter) => irFilter.selected,
        );

        if (selectedFilters.length === 1) {
            return selectedFilters[0].name;
        } else if (selectedFilters.length > 1) {
            return _t("%s selected", selectedFilters.length);
        } else {
            return _t("None");
        }
    }

    get availablePeriodOrder() {
        return { descending: _t("Descending"), ascending: _t("Ascending") };
    }

    get periodOrder() {
        return this.controller.options.comparison.period_order === "descending"
            ? _t("Descending")
            : _t("Ascending");
    }

    get selectedExtraOptions() {
        const selectedExtraOptions = [];

        if (this.controller.groups.account_readonly && this.controller.filters.show_draft) {
            selectedExtraOptions.push(
                this.controller.options.all_entries
                    ? _t("With Draft Entries")
                    : _t("Posted Entries Only"),
            );
        }
        if (this.controller.filters.show_unreconciled && this.controller.options.unreconciled) {
            selectedExtraOptions.push(_t("Only Show Unreconciled Entries"));
        }
        if (this.controller.options.include_analytic_without_aml) {
            selectedExtraOptions.push(_t("Including Analytic Simulations"));
        }
        return selectedExtraOptions.join(", ");
    }

    get dropdownProps() {
        return {
            shouldFocusChildInput: false,
            hotkeys: {
                arrowright: (index, items) => this.focusInnerInput(index, items),
            },
        };
    }

    get periodLabel() {
        return this.controller.options.comparison.number_period > 1 ? _t("Periods") : _t("Period");
    }
    //------------------------------------------------------------------------------------------------------------------
    // Helpers
    //------------------------------------------------------------------------------------------------------------------
    get hasAnalyticGroupbyFilter() {
        return Boolean(this.controller.groups.analytic_accounting) && (Boolean(this.controller.filters.show_analytic_groupby) || Boolean(this.controller.filters.show_analytic_plan_groupby));
    }

    get hasExtraOptionsFilter() {
        return (
            "report_cash_basis" in this.controller.options ||
            this.controller.filters.show_draft ||
            this.controller.filters.show_all ||
            this.controller.filters.show_unreconciled ||
            this.hasUIFilter
        );
    }

    get hasUIFilter() {
        return (
            this.controller.filters.show_hide_0_lines !== "never" ||
            "horizontal_split" in this.controller.options
        );
    }

    get hasFiscalPositionFilter() {
        const isMultiCompany = this.controller.options.companies.length > 1;
        const minimumFiscalPosition = this.controller.options.allow_domestic ? 0 : 1;
        const hasFiscalPositions =
            this.controller.options.available_vat_fiscal_positions.length > minimumFiscalPosition;
        return hasFiscalPositions && isMultiCompany;
    }

    //------------------------------------------------------------------------------------------------------------------
    // Dates
    //------------------------------------------------------------------------------------------------------------------
    // Getters
    dateFrom(optionKey) {
        return DateTime.fromISO(this.controller.options[optionKey].date_from);
    }

    dateTo(optionKey) {
        return DateTime.fromISO(this.controller.options[optionKey].date_to);
    }

    // Setters
    setDate(optionKey, type, date) {
        if (date)
            this.controller.options[optionKey][`date_${type}`] = date;
        else
            this.dialog.add(WarningDialog, {
                title: _t("Odoo Warning"),
                message: _t("Date cannot be empty"),
            });
    }

    setDateFrom(optionKey, dateFrom) {
        this.setDate(optionKey, 'from', dateFrom);
    }

    setDateTo(optionKey, dateTo) {
        this.setDate(optionKey, 'to', dateTo);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Number of periods
    //------------------------------------------------------------------------------------------------------------------
    setNumberPeriods(ev) {
        const numberPeriods = ev.target.value;

        if (numberPeriods >= 1)
            this.controller.options.comparison.number_period = parseInt(numberPeriods);
        else
            this.dialog.add(WarningDialog, {
                title: _t("Odoo Warning"),
                message: _t("Number of periods cannot be smaller than 1"),
            });
    }

    //------------------------------------------------------------------------------------------------------------------
    // Records
    //------------------------------------------------------------------------------------------------------------------
    getMultiRecordSelectorProps(resModel, optionKey) {
        return {
            resModel,
            resIds: this.controller.options[optionKey],
            update: (resIds) => {
                this.filterClicked(optionKey, resIds);
            },
        };
    }

    //------------------------------------------------------------------------------------------------------------------
    // Rounding unit
    //------------------------------------------------------------------------------------------------------------------
    roundingUnitName(roundingUnit) {
        return _t("In %s", this.controller.options["rounding_unit_names"][roundingUnit]);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Generic filters
    //------------------------------------------------------------------------------------------------------------------
    async filterClicked(optionKey, optionValue = undefined, reload = false) {
        this.dirtyFilter = !reload;

        if (optionValue !== undefined) {
            await this.controller.updateOption(optionKey, optionValue, reload);
        } else {
            await this.controller.toggleOption(optionKey, reload);
        }
    }

    async applyFilters(isDropDownOpen, optionKey = null) {
        if (!isDropDownOpen && this.dirtyFilter) {
            // We only reload the view if the dropdown state changed to close state
            await this.controller.reload(optionKey, this.controller.options);
            this.dirtyFilter = false;
        }
    }

    //------------------------------------------------------------------------------------------------------------------
    // Custom filters
    //------------------------------------------------------------------------------------------------------------------
    selectJournal(journal) {
        this.dirtyFilter = true;
        if (journal.model === "account.journal.group") {
            this.controller.options.__journal_group_action = {
                action: journal.selected ? "remove" : "add",
                id: parseInt(journal.id),
            };
        }
        journal.selected = !journal.selected;
    }

    async filterVariant(reportId) {
        this.controller.saveSessionOptions({
            ...this.controller.options,
            selected_variant_id: reportId,
            sections_source_id: reportId,
        });
        await this.controller.displayReport(reportId);
    }

    async filterTaxUnit(taxUnit) {
        await this.filterClicked("tax_unit", taxUnit.id, true);
        this.controller.saveSessionOptions(this.controller.options);

        // force the company to those impacted by the tax units
        this.companyService.setCompanies(taxUnit.company_ids);
    }

    async toggleHideZeroLines() {
        // Avoid calling the database when this filter is toggled; as the exact same lines would be returned; just reassign visibility.
        await this.controller.toggleOption("hide_0_lines", false);

        this.controller.saveSessionOptions(this.controller.options);
        this.controller.assignLinesVisibility(this.controller.lines);
    }

    async toggleHorizontalSplit() {
        await this.controller.toggleOption("horizontal_split", false);
        this.controller.saveSessionOptions(this.controller.options);
    }

    async filterRoundingUnit(rounding) {
        await this.controller.updateOption('rounding_unit', rounding, false);

        this.controller.saveSessionOptions(this.controller.options);

        this.controller.lines = await this.controller.orm.call(
            "account.report",
            "format_column_values",
            [
                this.controller.options,
                this.controller.lines,
            ],
        );
    }
}
