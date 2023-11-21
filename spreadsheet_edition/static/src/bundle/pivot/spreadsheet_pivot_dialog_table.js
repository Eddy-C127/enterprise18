/** @odoo-module */
import { Component } from "@odoo/owl";

export class PivotDialogTable extends Component {
    static template = "spreadsheet_edition.PivotDialogTable";
    static props = {
        colHeaders: Array,
        rowHeaders: Array,
        values: Array,
        onCellSelected: Function,
    };

    _onCellClicked(formula) {
        this.props.onCellSelected({ formula });
    }
}
