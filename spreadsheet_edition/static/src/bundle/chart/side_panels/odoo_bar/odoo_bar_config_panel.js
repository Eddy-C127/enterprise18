/** @odoo-module */

import { CommonOdooChartConfigPanel } from "../common/config_panel";

export class OdooBarChartConfigPanel extends CommonOdooChartConfigPanel {
    static template = "spreadsheet_edition.OdooBarChartConfigPanel";
    onUpdateStacked(ev) {
        this.props.updateChart(this.props.figureId, {
            stacked: ev.target.checked,
        });
    }
}
