/** @odoo-module */

import { click, editInput, getFixture, nextTick } from "@web/../tests/helpers/utils";
import {
    getBasicData,
    getBasicPivotArch,
    getBasicServerData,
} from "@spreadsheet/../tests/utils/data";
import { getCellValue } from "@spreadsheet/../tests/utils/getters";
import { createSpreadsheetFromPivotView } from "../../utils/pivot_helpers";
import { PivotUIPlugin } from "@spreadsheet/pivot/plugins/pivot_ui_plugin";
import { insertPivotInSpreadsheet } from "@spreadsheet/../tests/utils/pivot";
import * as dsHelpers from "@web/../tests/core/domain_selector_tests";

let target;

QUnit.module(
    "documents_spreadsheet > Pivot Side Panel",
    {
        beforeEach: function () {
            target = getFixture();
        },
    },
    function () {
        QUnit.test("Open pivot properties", async function (assert) {
            const { model, env } = await createSpreadsheetFromPivotView({
                serverData: {
                    models: getBasicData(),
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partner" display_quantity="true">
                                <field name="foo" type="col"/>
                                <field name="bar" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            const [pivotId] = model.getters.getPivotIds();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();
            let title = target.querySelector(".o-sidePanelTitle").innerText;
            assert.equal(title, "Pivot properties");

            const sections = target.querySelectorAll(".o_side_panel_section");
            assert.equal(sections.length, 5, "it should have 5 sections");
            const [pivotName, pivotModel, domain, dimensions, measures] = sections;

            assert.equal(pivotName.children[0].innerText, "Pivot name");
            assert.equal(pivotName.children[1].innerText, "(#1) Partner by Foo");

            assert.equal(pivotModel.children[0].innerText, "Model");
            assert.equal(pivotModel.children[1].innerText, "Partner (partner)");

            assert.equal(domain.children[0].innerText, "Domain");
            assert.equal(domain.children[1].innerText, "Match all records\nInclude archived");

            assert.equal(measures.children[0].innerText, "Measures");
            assert.equal(measures.children[1].innerText, "Count");
            assert.equal(measures.children[2].innerText, "Probability");

            assert.ok(measures.children[3].innerText.startsWith("Last updated at"));
            assert.equal(measures.children[4].innerText, "Refresh values");

            assert.equal(dimensions.children[0].innerText, "Dimensions");
            assert.equal(dimensions.children[1].innerText, "Bar");
            assert.equal(dimensions.children[2].innerText, "Foo");

            env.openSidePanel("ALL_PIVOTS_PANEL");
            await nextTick();
            title = target.querySelector(".o-sidePanelTitle").innerText;
            assert.equal(title, "Pivot properties");

            assert.containsOnce(target, ".o_side_panel_select");
        });

        QUnit.test("Pivot properties panel shows ascending sorting", async function (assert) {
            const { model, env } = await createSpreadsheetFromPivotView({
                actions: async (target) => {
                    await click(target.querySelector("thead .o_pivot_measure_row"));
                },
            });
            const [pivotId] = model.getters.getPivotIds();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();

            const sections = target.querySelectorAll(".o_side_panel_section");
            assert.equal(sections.length, 6, "it should have 6 sections");
            const pivotSorting = sections[4];

            assert.equal(pivotSorting.children[0].innerText, "Sorting");
            assert.equal(pivotSorting.children[1].innerText, "Probability (ascending)");
        });

        QUnit.test("Pivot properties panel shows descending sorting", async function (assert) {
            const { model, env } = await createSpreadsheetFromPivotView({
                actions: async (target) => {
                    await click(target.querySelector("thead .o_pivot_measure_row"));
                    await click(target.querySelector("thead .o_pivot_measure_row"));
                },
            });
            const [pivotId] = model.getters.getPivotIds();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();

            const sections = target.querySelectorAll(".o_side_panel_section");
            assert.equal(sections.length, 6, "it should have 6 sections");
            const pivotSorting = sections[4];

            assert.equal(pivotSorting.children[0].innerText, "Sorting");
            assert.equal(pivotSorting.children[1].innerText, "Probability (descending)");
        });

        QUnit.test("can refresh a sorted pivot", async function (assert) {
            const { model, env } = await createSpreadsheetFromPivotView({
                actions: async (target) => {
                    await click(target.querySelector("thead .o_pivot_measure_row"));
                },
            });
            const [pivotId] = model.getters.getPivotIds();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();

            let sections = target.querySelectorAll(".o_side_panel_section");
            assert.equal(sections.length, 6, "it should have 6 sections");
            let pivotSorting = sections[4];

            assert.equal(pivotSorting.children[0].innerText, "Sorting");
            assert.equal(pivotSorting.children[1].innerText, "Probability (ascending)");
            await click(target, ".o_refresh_measures");
            sections = target.querySelectorAll(".o_side_panel_section");
            assert.equal(sections.length, 6, "it should have 6 sections");
            pivotSorting = sections[4];
            assert.equal(pivotSorting.children[0].innerText, "Sorting");
            assert.equal(pivotSorting.children[1].innerText, "Probability (ascending)");
        });

        QUnit.test("Can select a pivot from the pivot list side panel", async function (assert) {
            const { model, env } = await createSpreadsheetFromPivotView();
            await insertPivotInSpreadsheet(model, { arch: getBasicPivotArch() });

            env.openSidePanel("ALL_PIVOTS_PANEL");
            await nextTick();
            assert.containsN(target, ".o_side_panel_select", 2);

            await click(target.querySelectorAll(".o_side_panel_select")[0]);
            let pivotName = target.querySelector(".o_sp_en_display_name").textContent;
            assert.equal(pivotName, "(#1) Partners by Foo");

            await click(target, ".o_pivot_cancel");
            await click(target.querySelectorAll(".o_side_panel_select")[1]);
            pivotName = target.querySelector(".o_sp_en_display_name").textContent;
            assert.equal(pivotName, "(#2) Partner Pivot");
        });

        QUnit.test(
            "Can refresh the pivot from the pivot properties panel",
            async function (assert) {
                assert.expect(1);

                const data = getBasicData();

                const { model, env } = await createSpreadsheetFromPivotView({
                    serverData: {
                        models: data,
                        views: getBasicServerData().views,
                    },
                });
                data.partner.records.push({
                    active: true,
                    id: 5,
                    foo: 12,
                    bar: true,
                    product: 37,
                    probability: 10,
                    create_date: "2016-02-02",
                    date: "2016-02-02",
                    field_with_array_agg: 1,
                    product_id: 41,
                    tag_ids: [],
                });
                const [pivotId] = model.getters.getPivotIds();
                env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
                await nextTick();
                await click(target, ".o_refresh_measures");
                assert.equal(getCellValue(model, "D4"), 10 + 10);
            }
        );

        QUnit.test(
            "Open pivot properties properties with non-loaded field",
            async function (assert) {
                const { model, env } = await createSpreadsheetFromPivotView();
                const pivotPlugin = model["handlers"].find(
                    (handler) => handler instanceof PivotUIPlugin
                );
                const dataSource = Object.values(pivotPlugin.dataSources._dataSources)[0];
                // remove all loading promises and the model to simulate the data source is not loaded
                dataSource._loadPromise = undefined;
                dataSource._createModelPromise = undefined;
                dataSource._model = undefined;
                env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId: "1" });
                await nextTick();
                const sections = target.querySelectorAll(".o_side_panel_section");
                const fields = sections[3];
                assert.equal(fields.children[1].innerText, "Bar");
                const measures = sections[4];
                assert.equal(measures.children[1].innerText, "Probability");
            }
        );

        QUnit.test("Update the pivot title from the side panel", async function (assert) {
            const { model, env } = await createSpreadsheetFromPivotView();
            const [pivotId] = model.getters.getPivotIds();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();
            await click(target, ".o_sp_en_rename");
            await editInput(target, ".o_sp_en_name", "new name");
            await click(target, ".o_sp_en_save");
            assert.equal(model.getters.getPivotName("1"), "new name");
        });

        QUnit.test("Update the pivot domain from the side panel", async function (assert) {
            const { model, env } = await createSpreadsheetFromPivotView({
                mockRPC(route) {
                    if (route === "/web/domain/validate") {
                        return true;
                    }
                },
            });
            const [pivotId] = model.getters.getPivotIds();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();
            const fixture = getFixture();
            await click(fixture.querySelector(".o_edit_domain"));
            await dsHelpers.addNewRule(fixture);
            await click(fixture.querySelector(".modal-footer .btn-primary"));
            assert.deepEqual(model.getters.getPivotDefinition(pivotId).domain, [["id", "=", 1]]);
            assert.equal(dsHelpers.getConditionText(fixture), "ID = 1");
        });

        QUnit.test(
            "Opening the sidepanel of a pivot while the panel of another pivot is open updates the side panel",
            async function (assert) {
                const { model, env } = await createSpreadsheetFromPivotView();
                const arch = /* xml */ `
                    <pivot string="Product">
                        <field name="name" type="col"/>
                        <field name="active" type="row"/>
                        <field name="__count" type="measure"/>
                    </pivot>`;
                await insertPivotInSpreadsheet(model, {
                    arch,
                    resModel: "product",
                });
                const pivotIds = model.getters.getPivotIds();

                env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId: pivotIds[0] });
                await nextTick();
                let modelName = target.querySelector(".o_side_panel_section .o_model_name");
                assert.equal(modelName.innerText, "Partner (partner)");

                env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId: pivotIds[1] });
                await nextTick();
                modelName = target.querySelector(".o_side_panel_section .o_model_name");
                assert.equal(modelName.innerText, "Product (product)");
            }
        );

        QUnit.test("Duplicate the pivot from the side panel", async function (assert) {
            const { model, env } = await createSpreadsheetFromPivotView();
            const [pivotId] = model.getters.getPivotIds();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();

            assert.equal(model.getters.getPivotIds().length, 1);
            assert.equal(
                target.querySelector(".o_sp_en_display_name").innerText,
                "(#1) Partners by Foo"
            );

            await click(target, ".o_duplicate_pivot");
            assert.equal(model.getters.getPivotIds().length, 2);
            assert.equal(
                target.querySelector(".o_sp_en_display_name").innerText,
                "(#2) Partners by Foo"
            );
        });

        QUnit.test(
            "A warning is displayed in the side panel if the pivot is unused",
            async function (assert) {
                const { model, env } = await createSpreadsheetFromPivotView();
                const [pivotId] = model.getters.getPivotIds();
                env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
                await nextTick();

                const sidePanelEl = target.querySelector(".o-sidePanel");
                assert.containsNone(sidePanelEl, ".o-validation-warning");

                model.dispatch("CREATE_SHEET", { sheetId: "sh2", name: "Sheet2" });
                const activeSheetId = model.getters.getActiveSheetId();
                model.dispatch("ACTIVATE_SHEET", { sheetIdFrom: activeSheetId, sheetIdTo: "sh2" });
                model.dispatch("DELETE_SHEET", { sheetId: activeSheetId });
                await nextTick();

                assert.containsOnce(sidePanelEl, ".o-validation-warning");

                model.dispatch("REQUEST_UNDO");
                await nextTick();
                assert.containsNone(sidePanelEl, ".o-validation-warning");
            }
        );
    }
);
