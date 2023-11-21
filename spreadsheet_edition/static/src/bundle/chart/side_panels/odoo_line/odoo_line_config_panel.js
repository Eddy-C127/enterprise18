/** @odoo-module */

import { CommonOdooChartConfigPanel } from "../common/config_panel";

export class OdooLineChartConfigPanel extends CommonOdooChartConfigPanel {
    static template = "spreadsheet_edition.OdooLineChartConfigPanel";
    onUpdateStacked(ev) {
        this.props.updateChart(this.props.figureId, {
            stacked: ev.target.checked,
        });
    }
    onUpdateCumulative(ev) {
        this.props.updateChart(this.props.figureId, {
            cumulative: ev.target.checked,
        });
    }
}
