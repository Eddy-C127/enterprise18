import { Model, helpers } from "@odoo/o-spreadsheet";
import { getBasicData } from "@spreadsheet/../tests/utils/data";
import { addGlobalFilter, createBasicChart } from "@spreadsheet/../tests/utils/commands";
import { makeTestEnv } from "@web/../tests/helpers/mock_env";
import { registry } from "@web/core/registry";
import { menuService } from "@web/webclient/menus/menu_service";
import { actionService } from "@web/webclient/actions/action_service";
import {
    createSpreadsheetWithChart,
    insertChartInSpreadsheet,
} from "@spreadsheet/../tests/utils/chart";

const { toZone } = helpers;
const chartId = "uuid1";

QUnit.module("spreadsheet > ir.ui.menu chart plugin", {
    beforeEach: function () {
        this.serverData = {};
        this.serverData.menus = {
            root: {
                id: "root",
                children: [1],
                name: "root",
                appID: "root",
            },
            1: {
                id: 1,
                children: [],
                name: "test menu 1",
                xmlid: "documents_spreadsheet.test.menu",
                appID: 1,
                actionID: "menuAction",
            },
        };
        this.serverData.actions = {
            menuAction: {
                id: 99,
                xml_id: "ir.ui.menu",
                name: "menuAction",
                res_model: "ir.ui.menu",
                type: "ir.actions.act_window",
                views: [[false, "list"]],
            },
        };
        this.serverData.views = {};
        this.serverData.views["ir.ui.menu,false,list"] = `<tree></tree>`;
        this.serverData.models = {
            ...getBasicData(),
            "ir.ui.menu": {
                fields: {
                    name: { string: "Name", type: "char" },
                    action: { string: "Action", type: "char" },
                    groups_id: {
                        string: "Groups",
                        type: "many2many",
                        relation: "res.group",
                    },
                },
                records: [
                    {
                        id: 1,
                        name: "test menu 1",
                        action: "action1",
                        groups_id: [10],
                    },
                ],
            },
            "res.users": {
                fields: {
                    name: { string: "Name", type: "char" },
                    groups_id: {
                        string: "Groups",
                        type: "many2many",
                        relation: "res.group",
                    },
                },
                records: [{ id: 1, name: "Raoul", groups_id: [10] }],
            },
            "ir.actions": {
                fields: {
                    name: { string: "Name", type: "char" },
                },
                records: [{ id: 1 }],
            },
            "res.group": {
                fields: { name: { string: "Name", type: "char" } },
                records: [{ id: 10, name: "test group" }],
            },
        };
        registry.category("services").add("menu", menuService).add("action", actionService);
    },
});

QUnit.test("link is kept when copying chart", async (assert) => {
    const env = await makeTestEnv({ serverData: this.serverData });
    const model = new Model({}, { custom: { env } });
    createBasicChart(model, chartId);
    model.dispatch("LINK_ODOO_MENU_TO_CHART", {
        chartId,
        odooMenuId: 1,
    });
    assert.equal(model.getters.getChartOdooMenu(chartId).id, 1);
    model.dispatch("UPDATE_CHART", {
        sheetId: model.getters.getActiveSheetId(),
        id: chartId,
        definition: {
            ...model.getters.getChartDefinition(chartId),
            type: "line",
        },
    });
    assert.equal(model.getters.getChartOdooMenu(chartId).id, 1);
    const sheetId = model.getters.getActiveSheetId();
    model.dispatch("SELECT_FIGURE", { id: chartId });
    model.dispatch("COPY");
    model.dispatch("PASTE", { target: [toZone("A1")] });
    const chartIds = model.getters.getChartIds(sheetId);
    assert.strictEqual(chartIds.length, 2);
    for (const _chartId of chartIds) {
        assert.equal(model.getters.getChartOdooMenu(_chartId).id, 1);
    }
});

QUnit.test("copy/paste Odoo chart field matching", async (assert) => {
    const { model } = await createSpreadsheetWithChart({ type: "odoo_pie" });
    insertChartInSpreadsheet(model, "odoo_bar");
    const sheetId = model.getters.getActiveSheetId();
    const [chartId1, chartId2] = model.getters.getChartIds(sheetId);
    const fieldMatching = {
        chart: {
            [chartId1]: { type: "many2one", chain: "partner_id.company_id" },
            [chartId2]: { type: "many2one", chain: "user_id.company_id" },
        },
    };
    const filterId = "44";
    await addGlobalFilter(
        model,
        {
            id: filterId,
            type: "relation",
            modelName: "res.company",
            label: "Relation Filter",
        },
        fieldMatching
    );
    model.dispatch("SELECT_FIGURE", { id: chartId2 });
    model.dispatch("COPY");
    model.dispatch("PASTE", { target: [toZone("A1")] });
    const chartIds = model.getters.getChartIds(sheetId);
    assert.strictEqual(
        model.getters.getOdooChartFieldMatching(chartId1, filterId).chain,
        "partner_id.company_id"
    );
    assert.strictEqual(
        model.getters.getOdooChartFieldMatching(chartId2, filterId).chain,
        "user_id.company_id"
    );
    assert.strictEqual(
        model.getters.getOdooChartFieldMatching(chartIds[2], filterId).chain,
        "user_id.company_id"
    );
});

QUnit.test("cut/paste Odoo chart field matching", async (assert) => {
    const { model } = await createSpreadsheetWithChart({ type: "odoo_pie" });
    insertChartInSpreadsheet(model, "odoo_bar");
    const sheetId = model.getters.getActiveSheetId();
    const [chartId1, chartId2] = model.getters.getChartIds(sheetId);
    const fieldMatching = {
        chart: {
            [chartId1]: { type: "many2one", chain: "partner_id.company_id" },
            [chartId2]: { type: "many2one", chain: "user_id.company_id" },
        },
    };
    const filterId = "44";
    await addGlobalFilter(
        model,
        {
            id: filterId,
            type: "relation",
            modelName: "res.company",
            label: "Relation Filter",
        },
        fieldMatching
    );
    model.dispatch("SELECT_FIGURE", { id: chartId2 });
    model.dispatch("CUT");
    model.dispatch("PASTE", { target: [toZone("A1")] });
    const chartIds = model.getters.getChartIds(sheetId);
    assert.strictEqual(
        model.getters.getOdooChartFieldMatching(chartId1, filterId).chain,
        "partner_id.company_id"
    );
    assert.throws(() => model.getters.getChartFieldMatch(chartId2));
    assert.strictEqual(
        model.getters.getOdooChartFieldMatching(chartIds[1], filterId).chain,
        "user_id.company_id"
    );
});
