import { Component } from "@odoo/owl";

export class PivotDimensionOrder extends Component {
    static template = "spreadsheet_edition.PivotDimensionOrder";
    static props = {
        dimension: Object,
        onUpdated: Function,
    };
}
