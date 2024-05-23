import { components } from "@odoo/o-spreadsheet";
import { _t } from "@web/core/l10n/translation";

const { ChartWithAxisDesignPanel } = components;

export class OdooChartWithAxisDesignPanel extends ChartWithAxisDesignPanel {
    static template = "spreadsheet_edition.OdooChartWithAxisDesignPanel";

    get axesList() {
        return [
          { id: "x", name: _t("Horizontal axis") },
          { id: "y", name: _t("Vertical axis") },
        ];
      }

    updateVerticalAxisPosition(ev) {
        this.props.updateChart(this.props.figureId, {
            verticalAxisPosition: ev.target.value,
        });
    }
}
