/** @odoo-module **/

import { helpers, stores } from "@odoo/o-spreadsheet";
import { initCallbackRegistry } from "@spreadsheet/o_spreadsheet/init_callbacks";
import { Domain } from "@web/core/domain";

const uuidGenerator = new helpers.UuidGenerator();

const { SidePanelStore } = stores;

export function insertChart(chartData) {
    const chartType = `odoo_${chartData.metaData.mode}`;
    const definition = {
        metaData: {
            groupBy: chartData.metaData.groupBy,
            measure: chartData.metaData.measure,
            order: chartData.metaData.order,
            resModel: chartData.metaData.resModel,
        },
        searchParams: {
            ...chartData.searchParams,
            domain: new Domain(chartData.searchParams.domain).toJson(),
        },
        stacked: chartData.metaData.stacked,
        fillArea: chartType === "odoo_line",
        cumulative: chartData.metaData.cumulated,
        title: { text: chartData.name },
        background: "#FFFFFF",
        legendPosition: "top",
        verticalAxisPosition: "left",
        type: chartType,
        dataSourceId: uuidGenerator.uuidv4(),
        id: uuidGenerator.uuidv4(),
    };
    return (model, stores) => {
        model.dispatch("CREATE_CHART", {
            sheetId: model.getters.getActiveSheetId(),
            id: definition.id,
            position: {
                x: 10,
                y: 10,
            },
            definition,
        });
        if (chartData.menuXMLId) {
            model.dispatch("LINK_ODOO_MENU_TO_CHART", {
                chartId: definition.id,
                odooMenuId: chartData.menuXMLId,
            });
        }
        const sidePanel = stores.get(SidePanelStore);
        sidePanel.open("ChartPanel", { figureId: definition.id });
    };
}

initCallbackRegistry.add("insertChart", insertChart);
