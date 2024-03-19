import { Component } from "@odoo/owl";

export class PivotDimension extends Component {
    static template = "spreadsheet_edition.PivotDimension";
    static props = {
        dimension: Object,
        onRemoved: { type: Function, optional: true },
        slots: { type: Object, optional: true },
    };
}
