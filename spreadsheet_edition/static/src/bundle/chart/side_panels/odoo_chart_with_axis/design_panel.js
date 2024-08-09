import { components, constants } from "@odoo/o-spreadsheet";
import { _t } from "@web/core/l10n/translation";

const { ChartWithAxisDesignPanel } = components;
const { CHART_AXIS_CHOICES } = constants;

export class OdooChartWithAxisDesignPanel extends ChartWithAxisDesignPanel {
    static template = "spreadsheet_edition.OdooChartWithAxisDesignPanel";

    axisChoices = CHART_AXIS_CHOICES;

    get axesList() {
        return [
            { id: "x", name: _t("Horizontal axis") },
            { id: "y", name: _t("Vertical axis") },
        ];
    }

    updateVerticalAxisPosition(verticalAxisPosition) {
        this.props.updateChart(this.props.figureId, {
            verticalAxisPosition,
        });
    }
}
