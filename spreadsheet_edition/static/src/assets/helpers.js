/** @odoo-module */

import { _t } from "@web/core/l10n/translation";

export const PERIODS = {
    day: _t("Day"),
    week: _t("Week"),
    month: _t("Month"),
    quarter: _t("Quarter"),
    year: _t("Year"),
};

export const BLANK_SPREADSHEET_TEMPLATE = {
    id: null,
    name: _t("Blank spreadsheet"),
    thumbnail: "/spreadsheet/static/img/spreadsheet.svg",
};
