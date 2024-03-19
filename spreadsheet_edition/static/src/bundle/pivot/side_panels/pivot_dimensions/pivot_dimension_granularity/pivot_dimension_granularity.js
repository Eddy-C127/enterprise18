import { Component } from "@odoo/owl";
import { PERIODS } from "@spreadsheet/pivot/pivot_helpers";

export class PivotDimensionGranularity extends Component {
    static template = "spreadsheet_edition.PivotDimensionGranularity";
    static props = {
        dimension: Object,
        onUpdated: Function,
        availableGranularities: Set,
    };
    periods = PERIODS;
    allGranularities = ["year", "quarter", "month", "week", "day"];
}
