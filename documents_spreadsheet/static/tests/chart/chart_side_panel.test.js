/** @odoo-module */

import {
    click,
    getFixture,
    patchWithCleanup,
    nextTick,
    editInput,
} from "@web/../tests/helpers/utils";
import { createBasicChart } from "@spreadsheet/../tests/legacy/utils/commands";
import { createSpreadsheet } from "@documents_spreadsheet/../tests/legacy/spreadsheet_test_utils";
import {
    createSpreadsheetFromGraphView,
    openChartSidePanel,
} from "@documents_spreadsheet/../tests/legacy/utils/chart_helpers";
import { GraphRenderer } from "@web/views/graph/graph_renderer";
import { patchGraphSpreadsheet } from "@spreadsheet_edition/assets/graph_view/graph_view";
import { registries } from "@odoo/o-spreadsheet";
import * as dsHelpers from "@web/../tests/core/domain_selector_tests";

const { chartSubtypeRegistry } = registries;

async function changeChartType(fixture, type) {
    await click(fixture, ".o-type-selector");
    await click(fixture, `.o-chart-type-item[data-id="${type}"]`);
}

function beforeEach() {
    patchWithCleanup(GraphRenderer.prototype, patchGraphSpreadsheet());
}

QUnit.module("documents_spreadsheet > chart side panel", { beforeEach }, () => {
    QUnit.test("Open a chart panel", async (assert) => {
        const { model, env } = await createSpreadsheetFromGraphView();
        await openChartSidePanel(model, env);
        const target = getFixture();
        assert.ok(target.querySelector(".o-sidePanel .o-sidePanelBody .o-chart"));
    });

    QUnit.test("From an Odoo chart, can only change to an Odoo chart", async (assert) => {
        const { model, env } = await createSpreadsheetFromGraphView();
        await openChartSidePanel(model, env);
        const target = getFixture();
        await click(target, ".o-type-selector");
        const odooChartTypes = chartSubtypeRegistry
            .getKeys()
            .filter((key) => key.startsWith("odoo_"))
            .sort();
        /** @type {NodeListOf<HTMLDivElement>} */
        const options = target.querySelectorAll(".o-chart-type-item");
        const optionValues = Array.from(options)
            .map((option) => option.dataset.id)
            .sort();
        assert.deepEqual(optionValues, odooChartTypes);
    });

    QUnit.test(
        "From a spreadsheet chart, can only change to a spreadsheet chart",
        async (assert) => {
            const { model, env } = await createSpreadsheet();
            createBasicChart(model, "1");
            await openChartSidePanel(model, env);
            const target = getFixture();
            await click(target, ".o-type-selector");
            /** @type {NodeListOf<HTMLDivElement>} */
            const options = target.querySelectorAll(".o-chart-type-item");
            const optionValues = Array.from(options)
                .map((option) => option.dataset.id)
                .sort();
            const nonOdooChartTypes = chartSubtypeRegistry
                .getKeys()
                .filter((key) => !key.startsWith("odoo_"))
                .sort();

            assert.deepEqual(optionValues, nonOdooChartTypes);
        }
    );

    QUnit.test(
        "Possible chart types are correct when switching from a spreadsheet to an odoo chart",
        async (assert) => {
            const { model, env } = await createSpreadsheetFromGraphView();
            createBasicChart(model, "nonOdooChartId");
            await openChartSidePanel(model, env);
            const target = getFixture();
            await click(target, ".o-type-selector");

            /** @type {NodeListOf<HTMLDivElement>} */
            let options = target.querySelectorAll(".o-chart-type-item");
            let optionValues = Array.from(options).map((option) => option.dataset.id);
            assert.ok(optionValues.every((value) => value.startsWith("odoo_")));

            model.dispatch("SELECT_FIGURE", { id: "nonOdooChartId" });
            await nextTick();

            await click(target, ".o-type-selector");
            options = target.querySelectorAll(".o-chart-type-item");
            optionValues = Array.from(options).map((option) => option.dataset.id);
            assert.ok(optionValues.every((value) => !value.startsWith("odoo_")));
        }
    );

    QUnit.test("Change odoo chart type", async (assert) => {
        const { model, env } = await createSpreadsheetFromGraphView();
        const sheetId = model.getters.getActiveSheetId();
        const chartId = model.getters.getChartIds(sheetId)[0];
        assert.strictEqual(model.getters.getChart(chartId).type, "odoo_bar");
        await openChartSidePanel(model, env);
        const target = getFixture();
        /** @type {HTMLSelectElement} */
        await changeChartType(target, "odoo_pie");
        assert.strictEqual(model.getters.getChart(chartId).type, "odoo_pie");

        await changeChartType(target, "odoo_line");
        assert.strictEqual(model.getters.getChart(chartId).verticalAxisPosition, "left");
        assert.strictEqual(model.getters.getChart(chartId).stacked, false);

        await changeChartType(target, "odoo_bar");
        assert.strictEqual(model.getters.getChart(chartId).type, "odoo_bar");
        assert.strictEqual(model.getters.getChart(chartId).stacked, false);

        await changeChartType(target, "odoo_stacked_bar");
        assert.strictEqual(model.getters.getChart(chartId).type, "odoo_bar");
        assert.strictEqual(model.getters.getChart(chartId).stacked, true);

        await changeChartType(target, "odoo_stacked_line");
        assert.strictEqual(model.getters.getChart(chartId).type, "odoo_line");
        assert.strictEqual(model.getters.getChart(chartId).stacked, true);
    });

    QUnit.test("stacked line chart", async (assert) => {
        const { model, env } = await createSpreadsheetFromGraphView();
        const sheetId = model.getters.getActiveSheetId();
        const chartId = model.getters.getChartIds(sheetId)[0];
        await openChartSidePanel(model, env);
        const target = getFixture();
        await changeChartType(target, "odoo_stacked_line");

        // checked by default
        assert.strictEqual(model.getters.getChart(chartId).stacked, true);
        assert.containsOnce(
            target,
            ".o-checkbox input[name='stackedBar']:checked",
            "checkbox should be checked"
        );

        // uncheck
        await click(target, ".o-checkbox input:checked");
        assert.strictEqual(model.getters.getChart(chartId).stacked, false);
        assert.containsNone(
            target,
            ".o-checkbox input[name='stackedBar']:checked",
            "checkbox should no longer be checked"
        );

        // check
        await click(target, ".o-checkbox input[name='stackedBar']");
        assert.strictEqual(model.getters.getChart(chartId).stacked, true);
        assert.containsOnce(target, ".o-checkbox input:checked", "checkbox should be checked");
    });

    QUnit.test("Change the title of a chart", async (assert) => {
        const { model, env } = await createSpreadsheetFromGraphView();
        const sheetId = model.getters.getActiveSheetId();
        const chartId = model.getters.getChartIds(sheetId)[0];
        assert.strictEqual(model.getters.getChart(chartId).type, "odoo_bar");
        await openChartSidePanel(model, env);
        const target = getFixture();
        await click(target, ".o-panel-design");
        /** @type {HTMLInputElement} */
        const input = target.querySelector(".o-chart-title input");
        assert.strictEqual(model.getters.getChart(chartId).title.text, "PartnerGraph");
        await editInput(input, null, "bla");
        assert.strictEqual(model.getters.getChart(chartId).title.text, "bla");
    });

    QUnit.test("Open chart odoo's data properties", async function (assert) {
        const target = getFixture();
        const { model, env } = await createSpreadsheetFromGraphView();
        const sheetId = model.getters.getActiveSheetId();
        const chartId = model.getters.getChartIds(sheetId)[0];

        // opening from a chart
        model.dispatch("SELECT_FIGURE", { id: chartId });
        env.openSidePanel("ChartPanel");
        await nextTick();

        const sections = target.querySelectorAll(".o-section");
        assert.equal(sections.length, 6, "it should have 6 sections");
        const [, , pivotModel, domain, , measures] = sections;

        assert.equal(pivotModel.children[0].innerText, "Model");
        assert.equal(pivotModel.children[1].innerText, "Partner (partner)");

        assert.equal(domain.children[0].innerText, "Domain");
        assert.equal(domain.children[1].innerText, "Match all records\nInclude archived");

        assert.ok(measures.children[0].innerText.startsWith("Last updated at"));
    });

    QUnit.test("Update the chart domain from the side panel", async function (assert) {
        const { model, env } = await createSpreadsheetFromGraphView({
            mockRPC(route) {
                if (route === "/web/domain/validate") {
                    return true;
                }
            },
        });
        const sheetId = model.getters.getActiveSheetId();
        const chartId = model.getters.getChartIds(sheetId)[0];
        model.dispatch("SELECT_FIGURE", { id: chartId });
        env.openSidePanel("ChartPanel");
        await nextTick();
        const fixture = getFixture();
        await click(fixture.querySelector(".o_edit_domain"));
        await dsHelpers.addNewRule(fixture);
        await click(fixture.querySelector(".modal-footer .btn-primary"));
        assert.deepEqual(model.getters.getChartDefinition(chartId).searchParams.domain, [
            ["id", "=", 1],
        ]);
        assert.equal(dsHelpers.getConditionText(fixture), "ID = 1");
    });

    QUnit.test("Cumulative line chart", async (assert) => {
        const { model, env } = await createSpreadsheetFromGraphView();
        const sheetId = model.getters.getActiveSheetId();
        const chartId = model.getters.getChartIds(sheetId)[0];
        await openChartSidePanel(model, env);
        const target = getFixture();
        await changeChartType(target, "odoo_line");
        console.log(model.getters.getChart(chartId).getDefinition());
        await click(target, ".o-checkbox input[name='cumulative']");
        // check
        assert.strictEqual(model.getters.getChart(chartId).cumulative, true);
        assert.containsOnce(
            target,
            ".o-checkbox input[name='cumulative']:checked",
            "checkbox should be checked"
        );

        // uncheck
        await click(target, ".o-checkbox input[name='cumulative']");
        assert.strictEqual(model.getters.getChart(chartId).cumulative, false);
        assert.containsNone(
            target,
            ".o-checkbox input[name='cumulative']:checked",
            "checkbox should no longer be checked"
        );
    });
});
