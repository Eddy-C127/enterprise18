/** @odoo-module */

import { click, editInput, getFixture, nextTick, triggerEvent } from "@web/../tests/helpers/utils";
import { getBasicData, getBasicPivotArch } from "@spreadsheet/../tests/utils/data";
import { createSpreadsheetFromPivotView } from "../../utils/pivot_helpers";
import { PivotUIPlugin } from "@spreadsheet/pivot/plugins/pivot_ui_plugin";
import { insertPivotInSpreadsheet } from "@spreadsheet/../tests/utils/pivot";
import * as dsHelpers from "@web/../tests/core/domain_selector_tests";
import { dragAndDrop } from "@web/../tests/legacy/helpers/utils";

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
            const { env, pivotId } = await createSpreadsheetFromPivotView({
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
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();
            let title = target.querySelector(".o-sidePanelTitle").innerText;
            assert.equal(title, "Pivot properties");

            const sections = target.querySelectorAll(".o_side_panel_section");
            assert.equal(sections.length, 5, "it should have 5 sections");
            const [pivotName, pivotModel, dimensions, domain, lastUpdate] = sections;
            assert.deepEqual(
                [...dimensions.children].map((el) => el.innerText),
                ["Columns\nAdd", "Foo", "Rows\nAdd", "Bar", "Measures", "Count", "Probability"]
            );

            assert.equal(pivotName.children[0].innerText, "Pivot name");
            assert.equal(pivotName.children[1].innerText, "(#1) Partner by Foo");

            assert.equal(pivotModel.children[0].innerText, "Model");
            assert.equal(pivotModel.children[1].innerText, "Partner (partner)");

            assert.equal(domain.children[0].innerText, "Domain");
            assert.equal(domain.children[1].innerText, "Match all records\nInclude archived");

            assert.ok(lastUpdate.children[0].innerText.startsWith("Last updated at"));

            env.openSidePanel("ALL_PIVOTS_PANEL");
            await nextTick();
            title = target.querySelector(".o-sidePanelTitle").innerText;
            assert.equal(title, "Pivot properties");

            assert.containsOnce(target, ".o_side_panel_select");
        });

        QUnit.test("Pivot properties panel shows ascending sorting", async function (assert) {
            const { env, pivotId } = await createSpreadsheetFromPivotView({
                actions: async (target) => {
                    await click(target.querySelector("thead .o_pivot_measure_row"));
                },
            });
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();

            const sections = target.querySelectorAll(".o_side_panel_section");
            assert.strictEqual(sections.length, 6, "it should have 6 sections");
            const pivotSorting = sections[4];

            assert.equal(pivotSorting.children[0].innerText, "Sorting");
            assert.equal(pivotSorting.children[1].innerText, "Probability (ascending)");
        });

        QUnit.test("Pivot properties panel shows descending sorting", async function (assert) {
            const { pivotId, env } = await createSpreadsheetFromPivotView({
                actions: async (target) => {
                    await click(target.querySelector("thead .o_pivot_measure_row"));
                    await click(target.querySelector("thead .o_pivot_measure_row"));
                },
            });
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();

            const sections = target.querySelectorAll(".o_side_panel_section");
            assert.strictEqual(sections.length, 6, "it should have 6 sections");
            const pivotSorting = sections[4];

            assert.equal(pivotSorting.children[0].innerText, "Sorting");
            assert.equal(pivotSorting.children[1].innerText, "Probability (descending)");
        });

        QUnit.test("Can select a pivot from the pivot list side panel", async function (assert) {
            const { model, env } = await createSpreadsheetFromPivotView();
            await insertPivotInSpreadsheet(model, "PIVOT#2", { arch: getBasicPivotArch() });

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
            "Open pivot properties properties with non-loaded field",
            async function (assert) {
                const { model, env, pivotId } = await createSpreadsheetFromPivotView();
                const pivotPlugin = model["handlers"].find(
                    (handler) => handler instanceof PivotUIPlugin
                );
                const dataSource = Object.values(pivotPlugin.pivots)[0];
                // remove all loading promises and the model to simulate the data source is not loaded
                dataSource._loadPromise = undefined;
                dataSource._createModelPromise = undefined;
                dataSource._model = undefined;
                env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
                await nextTick();
                const dimensionElements = target.querySelectorAll(".pivot-dimensions > div");
                assert.deepEqual(
                    Array.from(dimensionElements).map((el) => el.textContent.trim()),
                    ["Columns Add", "Foo", "Rows Add", "Bar", "Measures", "Probability"]
                );
            }
        );

        QUnit.test("Update the pivot title from the side panel", async function (assert) {
            const { model, env, pivotId } = await createSpreadsheetFromPivotView();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();
            await click(target, ".o_sp_en_rename");
            await editInput(target, ".o_sp_en_name", "new name");
            await click(target, ".o_sp_en_save");
            assert.equal(model.getters.getPivotName(pivotId), "new name");
        });

        QUnit.test("Update the pivot domain from the side panel", async function (assert) {
            const { model, env, pivotId } = await createSpreadsheetFromPivotView({
                mockRPC(route) {
                    if (route === "/web/domain/validate") {
                        return true;
                    }
                },
            });
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();
            const fixture = getFixture();
            await click(fixture.querySelector(".o_edit_domain"));
            await dsHelpers.addNewRule(fixture);
            await click(fixture.querySelector(".modal-footer .btn-primary"));
            assert.deepEqual(
                model.getters.getPivotDefinition(pivotId).domain,
                [],
                "update is deferred"
            );
            await click(fixture, ".pivot-defer-update .btn-link");
            assert.deepEqual(model.getters.getPivotDefinition(pivotId).domain, [["id", "=", 1]]);
            assert.equal(dsHelpers.getConditionText(fixture), "ID = 1");
        });

        QUnit.test(
            "Opening the sidepanel of a pivot while the panel of another pivot is open updates the side panel",
            async function (assert) {
                const { model, env, pivotId } = await createSpreadsheetFromPivotView();
                const arch = /* xml */ `
                    <pivot string="Product">
                        <field name="name" type="col"/>
                        <field name="active" type="row"/>
                        <field name="__count" type="measure"/>
                    </pivot>`;
                const pivotId2 = "PIVOT#2";
                await insertPivotInSpreadsheet(model, "PIVOT#2", {
                    arch,
                    resModel: "product",
                    id: pivotId2,
                });
                env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
                await nextTick();
                let modelName = target.querySelector(".o_side_panel_section .o_model_name");
                assert.equal(modelName.innerText, "Partner (partner)");

                env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId: pivotId2 });
                await nextTick();
                modelName = target.querySelector(".o_side_panel_section .o_model_name");
                assert.equal(modelName.innerText, "Product (product)");
            }
        );

        QUnit.test("Duplicate the pivot from the side panel", async function (assert) {
            const { model, env, pivotId } = await createSpreadsheetFromPivotView();
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
                const { model, env, pivotId } = await createSpreadsheetFromPivotView();
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

        QUnit.test("Deleting the pivot closes the side panel", async function (assert) {
            const { model, env, pivotId } = await createSpreadsheetFromPivotView();
            model.dispatch("SELECT_PIVOT", { pivotId });
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();
            const fixture = getFixture();
            const titleSelector = ".o-sidePanelTitle";
            assert.equal(fixture.querySelector(titleSelector).innerText, "Pivot properties");

            model.dispatch("REMOVE_PIVOT", { pivotId });
            await nextTick();
            assert.equal(fixture.querySelector(titleSelector), null);
        });

        QUnit.test("Undo a pivot insertion closes the side panel", async function (assert) {
            const { model, env, pivotId } = await createSpreadsheetFromPivotView();
            model.dispatch("SELECT_PIVOT", { pivotId });
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();
            const fixture = getFixture();
            const titleSelector = ".o-sidePanelTitle";
            assert.equal(fixture.querySelector(titleSelector).innerText, "Pivot properties");

            /**
             * This is a bit bad because we need three undo to remove the pivot
             * - AUTORESIZE
             * - INSERT_PIVOT
             * - ADD_PIVOT
             */
            model.dispatch("REQUEST_UNDO");
            model.dispatch("REQUEST_UNDO");
            model.dispatch("REQUEST_UNDO");
            await nextTick();
            assert.equal(fixture.querySelector(titleSelector), null);
        });

        QUnit.test("can drag a column dimension to row", async function (assert) {
            const { model, env, pivotId } = await createSpreadsheetFromPivotView({
                serverData: {
                    models: getBasicData(),
                    views: {
                        "partner,false,pivot": /*xml*/ `
                            <pivot>
                                <field name="foo" type="col"/>
                                <field name="bar" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            const fixture = getFixture();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();
            assert.containsNone(
                fixture,
                "pivot-defer-update",
                "defer updates is not displayed by default"
            );
            assert.containsNone(
                fixture,
                ".pivot-defer-update .btn",
                "it should not show the update/discard buttons"
            );
            let dimensionElements = fixture.querySelectorAll(".pivot-dimensions > div");
            assert.deepEqual(
                Array.from(dimensionElements).map((el) => el.textContent.trim()),
                ["Columns Add", "Foo", "Rows Add", "Bar", "Measures", "Probability"]
            );
            await dragAndDrop(
                ".pivot-dimensions div:nth-child(2)",
                ".pivot-dimensions div:nth-child(4)",
                "bottom"
            );
            assert.containsN(
                fixture,
                ".pivot-defer-update .btn",
                2,
                "it should show the update/discard buttons"
            );
            await nextTick();
            dimensionElements = fixture.querySelectorAll(".pivot-dimensions > div");
            assert.deepEqual(
                Array.from(dimensionElements).map((el) => el.textContent.trim()),
                ["Columns Add", "Rows Add", "Bar", "Foo", "Measures", "Probability"]
            );
            let definition = model.getters.getPivotDefinition(pivotId);
            // update is not applied until the user clicks on the save button
            assert.deepEqual(definition.colGroupBys, ["foo"]);
            assert.deepEqual(definition.rowGroupBys, ["bar"]);
            await click(fixture, ".pivot-defer-update .btn-link");
            assert.containsNone(
                fixture,
                ".pivot-defer-update .btn",
                "it should not show the update/discard buttons"
            );
            definition = model.getters.getPivotDefinition(pivotId);
            assert.deepEqual(definition.colGroupBys, []);
            assert.deepEqual(definition.rowGroupBys, ["bar", "foo"]);
        });

        QUnit.test(
            "updates are applied immediately after defer update checkbox has been unchecked",
            async function (assert) {
                const { model, env, pivotId } = await createSpreadsheetFromPivotView({
                    serverData: {
                        models: getBasicData(),
                        views: {
                            "partner,false,pivot": /*xml*/ `
                            <pivot>
                                <field name="foo" type="col"/>
                                <field name="bar" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                            "partner,false,search": `<search/>`,
                        },
                    },
                });
                const fixture = getFixture();
                env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
                await nextTick();
                await click(fixture, ".pivot-defer-update input[type='checkbox']");
                await dragAndDrop(
                    ".pivot-dimensions div:nth-child(2)",
                    ".pivot-dimensions div:nth-child(4)",
                    "bottom"
                );
                await nextTick();
                assert.containsNone(
                    fixture,
                    ".pivot-defer-update .btn",
                    "it should not show the update/discard buttons"
                );
                const definition = model.getters.getPivotDefinition(pivotId);
                assert.deepEqual(definition.colGroupBys, []);
                assert.deepEqual(definition.rowGroupBys, ["bar", "foo"]);
            }
        );

        QUnit.test("remove pivot dimension", async function (assert) {
            const { model, env, pivotId } = await createSpreadsheetFromPivotView({
                serverData: {
                    models: getBasicData(),
                    views: {
                        "partner,false,pivot": /*xml*/ `
                            <pivot>
                                <field name="foo" type="col"/>
                                <field name="bar" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            const fixture = getFixture();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();
            await click(fixture.querySelector(".pivot-dimensions .fa-times"));
            await nextTick();
            await click(fixture, ".pivot-defer-update .btn-link");
            const definition = model.getters.getPivotDefinition(pivotId);
            assert.deepEqual(definition.colGroupBys, []);
            assert.deepEqual(definition.rowGroupBys, ["bar"]);
        });

        QUnit.test("add column dimension", async function (assert) {
            const { model, env, pivotId } = await createSpreadsheetFromPivotView({
                serverData: {
                    models: getBasicData(),
                    views: {
                        "partner,false,pivot": /*xml*/ `
                            <pivot>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            const fixture = getFixture();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();
            await click(fixture.querySelector(".add-dimension.btn"));
            await click(fixture.querySelectorAll(".o-popover div")[1]);
            await click(fixture, ".pivot-defer-update .btn-link");
            const definition = model.getters.getPivotDefinition(pivotId);
            assert.deepEqual(definition.colGroupBys, ["bar"]);
            assert.deepEqual(definition.rowGroupBys, []);
        });

        QUnit.test("add row dimension", async function (assert) {
            const { model, env, pivotId } = await createSpreadsheetFromPivotView({
                serverData: {
                    models: getBasicData(),
                    views: {
                        "partner,false,pivot": /*xml*/ `
                            <pivot>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            const fixture = getFixture();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();
            await click(fixture.querySelectorAll(".add-dimension.btn")[1]);
            await click(fixture.querySelectorAll(".o-popover div")[1]);
            await click(fixture, ".pivot-defer-update .btn-link");
            const definition = model.getters.getPivotDefinition(pivotId);
            assert.deepEqual(definition.colGroupBys, []);
            assert.deepEqual(definition.rowGroupBys, ["bar"]);
        });

        QUnit.test("clicking the add button toggles the fields popover", async function (assert) {
            const { env, pivotId } = await createSpreadsheetFromPivotView({
                serverData: {
                    models: getBasicData(),
                    views: {
                        "partner,false,pivot": /*xml*/ `
                            <pivot>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            const fixture = getFixture();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();
            const addButton = fixture.querySelectorAll(".add-dimension.btn")[1];
            await click(addButton);
            assert.containsOnce(fixture, ".o-popover");
            await click(addButton);
            assert.containsNone(fixture, ".o-popover");
        });

        QUnit.test("add and search dimension", async function (assert) {
            const models = getBasicData();
            models.partner.fields = {
                foo: {
                    string: "Foo",
                    type: "integer",
                    store: true,
                    searchable: true,
                    aggregator: "sum",
                    groupable: true,
                },
                bar: {
                    string: "Bar",
                    type: "boolean",
                    store: true,
                    sortable: true,
                    groupable: true,
                    searchable: true,
                },
                foobar: {
                    string: "FooBar",
                    type: "char",
                    store: true,
                    sortable: true,
                    groupable: true,
                    searchable: true,
                },
                probability: {
                    string: "Probability",
                    type: "float",
                    store: true,
                    sortable: true,
                    groupable: true,
                    searchable: true,
                    aggregator: "avg",
                },
            };
            models.partner.records = [
                {
                    id: 1,
                    foo: 12,
                    bar: true,
                    probability: 10,
                },
            ];
            const { env, pivotId } = await createSpreadsheetFromPivotView({
                serverData: {
                    models,
                    views: {
                        "partner,false,pivot": /*xml*/ `
                            <pivot>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            const fixture = getFixture();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();
            await click(fixture.querySelector(".add-dimension.btn"));
            assert.deepEqual(
                [...fixture.querySelectorAll(".o-popover div")].map((el) => el.innerText),
                ["", "Bar", "Foo", "FooBar", "Probability"]
            );
            await editInput(fixture, ".o-popover input", "foo");
            assert.deepEqual(
                [...fixture.querySelectorAll(".o-popover div")].map((el) => el.innerText),
                ["", "Foo", "FooBar"]
            );
            await triggerEvent(fixture, ".o-popover input", "keydown", {
                key: "Enter",
            }); // does nothing because there are more than one field
            await editInput(fixture, ".o-popover input", "fooba");
            await triggerEvent(fixture, ".o-popover input", "keydown", {
                key: "Enter",
            });
            const dimensionElements = fixture.querySelectorAll(".pivot-dimensions > div");
            assert.deepEqual(
                Array.from(dimensionElements).map((el) => el.textContent.trim()),
                ["Columns Add", "FooBar", "Rows Add", "Measures", "Probability"]
            );
        });
    }
);
