/** @odoo-module */

import * as spreadsheet from "@odoo/o-spreadsheet";
import { CommonOdooChartConfigPanel } from "./common/config_panel";
import { OdooBarChartConfigPanel } from "./odoo_bar/odoo_bar_config_panel";
import { OdooLineChartConfigPanel } from "./odoo_line/odoo_line_config_panel";
import { OdooChartWithAxisDesignPanel } from "./odoo_chart_with_axis/design_panel";

const { chartSidePanelComponentRegistry } = spreadsheet.registries;
const { PieChartDesignPanel } = spreadsheet.components;

chartSidePanelComponentRegistry
    .add("odoo_line", {
        configuration: OdooLineChartConfigPanel,
        design: OdooChartWithAxisDesignPanel,
    })
    .add("odoo_bar", {
        configuration: OdooBarChartConfigPanel,
        design: OdooChartWithAxisDesignPanel,
    })
    .add("odoo_pie", {
        configuration: CommonOdooChartConfigPanel,
        design: PieChartDesignPanel,
    });
