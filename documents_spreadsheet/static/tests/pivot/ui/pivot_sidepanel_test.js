/** @odoo-module */

import {
    click,
    editInput,
    editSelect,
    getFixture,
    nextTick,
    triggerEvent,
} from "@web/../tests/helpers/utils";
import { getBasicData, getBasicPivotArch } from "@spreadsheet/../tests/utils/data";
import { createSpreadsheetFromPivotView } from "../../utils/pivot_helpers";
import { PivotUIPlugin } from "@spreadsheet/pivot/plugins/pivot_ui_plugin";
import {
    insertPivotInSpreadsheet,
    getZoneOfInsertedDataSource,
} from "@spreadsheet/../tests/utils/pivot";
import * as dsHelpers from "@web/../tests/core/domain_selector_tests";
import { getHighlightsFromStore } from "../../utils/store_helpers";
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
            assert.containsOnce(target, ".o-sidePanel");

            env.openSidePanel("ALL_PIVOTS_PANEL");
            await nextTick();

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
                assert.containsOnce(target, ".o-sidePanel");
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
            let definition = JSON.parse(JSON.stringify(model.getters.getPivotDefinition(pivotId)));
            assert.deepEqual(definition.columns, [{ name: "foo" }]);
            assert.deepEqual(definition.rows, [{ name: "bar" }]);
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
            // TODO use a snapshot
            definition = JSON.parse(JSON.stringify(model.getters.getPivotDefinition(pivotId)));
            // update is not applied until the user clicks on the save button
            assert.deepEqual(definition.columns, [{ name: "foo" }]);
            assert.deepEqual(definition.rows, [{ name: "bar" }]);
            await click(fixture, ".pivot-defer-update .btn-link");
            assert.containsNone(
                fixture,
                ".pivot-defer-update .btn",
                "it should not show the update/discard buttons"
            );
            definition = JSON.parse(JSON.stringify(model.getters.getPivotDefinition(pivotId)));
            assert.deepEqual(definition.columns, []);
            assert.deepEqual(definition.rows, [{ name: "bar" }, { name: "foo" }]);
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
                const definition = JSON.parse(
                    JSON.stringify(model.getters.getPivotDefinition(pivotId))
                );
                assert.deepEqual(definition.columns, []);
                assert.deepEqual(definition.rows, [{ name: "bar" }, { name: "foo" }]);
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
            const definition = JSON.parse(
                JSON.stringify(model.getters.getPivotDefinition(pivotId))
            );
            assert.deepEqual(definition.columns, []);
            assert.deepEqual(definition.rows, [{ name: "bar" }]);
        });

        QUnit.test("remove pivot date time dimension", async function (assert) {
            const { model, env, pivotId } = await createSpreadsheetFromPivotView({
                serverData: {
                    models: getBasicData(),
                    views: {
                        "partner,false,pivot": /*xml*/ `
                            <pivot>
                                <field name="date" type="row" interval="year"/>
                                <field name="date" type="row" interval="month"/>
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
            const definition = JSON.parse(
                JSON.stringify(model.getters.getPivotDefinition(pivotId))
            );
            assert.deepEqual(definition.rows, [{ name: "date", granularity: "month" }]);
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
            const definition = JSON.parse(
                JSON.stringify(model.getters.getPivotDefinition(pivotId))
            );
            assert.deepEqual(definition.columns, [{ name: "bar" }]);
            assert.deepEqual(definition.rows, []);
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
            const definition = JSON.parse(
                JSON.stringify(model.getters.getPivotDefinition(pivotId))
            );
            assert.deepEqual(definition.columns, []);
            assert.deepEqual(definition.rows, [{ name: "bar" }]);
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
            const { model, env, pivotId } = await createSpreadsheetFromPivotView({
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
            await editInput(fixture, ".o-popover input", "foo");
            await triggerEvent(fixture, ".o-popover input", "keydown", {
                key: "Enter",
            }); // does nothing because there are more than one field
            await editInput(fixture, ".o-popover input", "fooba");
            await triggerEvent(fixture, ".o-popover input", "keydown", {
                key: "Enter",
            });
            assert.deepEqual(model.getters.getPivotDefinition(pivotId).columns, []);
            assert.deepEqual(model.getters.getPivotDefinition(pivotId).rows, []);
            await click(fixture, ".pivot-defer-update .btn-link");
            assert.deepEqual(
                JSON.parse(JSON.stringify(model.getters.getPivotDefinition(pivotId))).columns,
                [{ name: "foobar" }]
            );
            assert.deepEqual(model.getters.getPivotDefinition(pivotId).rows, []);
        });

        QUnit.test("remove pivot measure", async function (assert) {
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
            const allDiv = fixture.querySelectorAll(".pivot-dimensions .fa-times");
            await click(allDiv[allDiv.length - 1]);
            await nextTick();
            await click(fixture, ".pivot-defer-update .btn-link");
            const definition = JSON.parse(
                JSON.stringify(model.getters.getPivotDefinition(pivotId))
            );
            assert.deepEqual(definition.columns, [{ name: "foo" }]);
            assert.deepEqual(definition.rows, [{ name: "bar" }]);
            assert.deepEqual(definition.measures, []);
        });

        QUnit.test("add measure", async function (assert) {
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
            await click(fixture.querySelectorAll(".add-dimension.btn")[2]);
            await click(fixture.querySelectorAll(".o-popover div")[1]);
            await click(fixture, ".pivot-defer-update .btn-link");
            const definition = JSON.parse(
                JSON.stringify(model.getters.getPivotDefinition(pivotId))
            );
            assert.deepEqual(definition.columns, [{ name: "foo" }]);
            assert.deepEqual(definition.rows, [{ name: "bar" }]);
            assert.deepEqual(definition.measures, [
                { name: "probability", aggregator: "avg" },
                { name: "__count" },
            ]);
        });

        QUnit.test("change measure aggregator", async function (assert) {
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
            assert.strictEqual(fixture.querySelector(".pivot-measure select").value, "avg");
            await editSelect(fixture, ".pivot-measure select", "sum");
            await click(fixture, ".pivot-defer-update .btn-link");
            assert.strictEqual(fixture.querySelector(".pivot-measure select").value, "sum");
            const definition = model.getters.getPivotDefinition(pivotId);
            assert.deepEqual(definition.measures, [{ name: "probability", aggregator: "sum" }]);
        });

        QUnit.test("change dimension order", async function (assert) {
            const { model, env, pivotId } = await createSpreadsheetFromPivotView({
                serverData: {
                    models: getBasicData(),
                    views: {
                        "partner,false,pivot": /*xml*/ `
                            <pivot>
                                <field name="foo" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            const fixture = getFixture();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();
            assert.strictEqual(fixture.querySelector(".pivot-dimensions select").value, "");
            await editSelect(fixture.querySelector(".pivot-dimensions select"), null, "desc");
            assert.strictEqual(fixture.querySelector(".pivot-dimensions select").value, "desc");
            await click(fixture, ".pivot-defer-update .btn-link");
            let definition = JSON.parse(JSON.stringify(model.getters.getPivotDefinition(pivotId)));
            assert.deepEqual(definition.rows, [{ name: "foo", order: "desc" }]);

            // reset to automatic
            await editSelect(fixture.querySelector(".pivot-dimensions select"), null, "");
            await click(fixture, ".pivot-defer-update .btn-link");
            definition = JSON.parse(JSON.stringify(model.getters.getPivotDefinition(pivotId)));
            assert.deepEqual(definition.rows, [{ name: "foo" }]);
        });

        QUnit.test("change date dimension granularity", async function (assert) {
            const { model, env, pivotId } = await createSpreadsheetFromPivotView({
                serverData: {
                    models: getBasicData(),
                    views: {
                        "partner,false,pivot": /*xml*/ `
                            <pivot>
                                <field name="date" interval="day" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            const fixture = getFixture();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
            await nextTick();
            assert.strictEqual(
                fixture.querySelectorAll(".pivot-dimensions select")[0].value,
                "day"
            );
            await editSelect(fixture.querySelectorAll(".pivot-dimensions select")[0], null, "week");
            assert.strictEqual(
                fixture.querySelectorAll(".pivot-dimensions select")[0].value,
                "week"
            );
            await click(fixture, ".pivot-defer-update .btn-link");
            const definition = JSON.parse(
                JSON.stringify(model.getters.getPivotDefinition(pivotId))
            );
            assert.deepEqual(definition.rows, [{ name: "date", granularity: "week" }]);
        });

        QUnit.test(
            "pivot with twice the same date field with different granularity",
            async function (assert) {
                const { env, pivotId } = await createSpreadsheetFromPivotView({
                    serverData: {
                        models: getBasicData(),
                        views: {
                            "partner,false,pivot": /*xml*/ `
                                <pivot>
                                    <field name="date" interval="year" type="row"/>
                                    <field name="date" interval="day" type="row"/>
                                    <field name="probability" type="measure"/>
                                </pivot>`,
                            "partner,false,search": `<search/>`,
                        },
                    },
                });
                const fixture = getFixture();
                env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
                await nextTick();
                const firstDateGroup = fixture.querySelectorAll(".pivot-dimensions select")[0];
                const secondDateGroup = fixture.querySelectorAll(".pivot-dimensions select")[2];
                assert.strictEqual(firstDateGroup.value, "year");
                assert.strictEqual(secondDateGroup.value, "day");
                assert.strictEqual(firstDateGroup.innerText, "Year\nQuarter\nMonth\nWeek");
                assert.strictEqual(secondDateGroup.innerText, "Quarter\nMonth\nWeek\nDay");
            }
        );

        QUnit.test(
            "Pivot cells are highlighted when their side panel is open",
            async function (assert) {
                const { model, env } = await createSpreadsheetFromPivotView();
                const sheetId = model.getters.getActiveSheetId();
                const pivotId = model.getters.getPivotIds()[0];
                env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivotId });
                await nextTick();

                const zone = getZoneOfInsertedDataSource(model, "pivot", pivotId);
                assert.deepEqual(getHighlightsFromStore(env), [{ sheetId, zone, noFill: true }]);
                await click(target, ".o-sidePanelClose");
                assert.deepEqual(getHighlightsFromStore(env), []);
            }
        );

        QUnit.test(
            "Pivot cells are highlighted when hovering the pivot in the list of pivots side panel",
            async function (assert) {
                const { model, env } = await createSpreadsheetFromPivotView();
                const sheetId = model.getters.getActiveSheetId();
                const pivotId = model.getters.getPivotIds()[0];
                env.openSidePanel("ALL_PIVOTS_PANEL", {});
                await nextTick();

                assert.deepEqual(getHighlightsFromStore(env), []);

                triggerEvent(target, ".o_side_panel_select", "mouseenter");
                const zone = getZoneOfInsertedDataSource(model, "pivot", pivotId);
                assert.deepEqual(getHighlightsFromStore(env), [{ sheetId, zone, noFill: true }]);

                triggerEvent(target, ".o_side_panel_select", "mouseleave");
                assert.deepEqual(getHighlightsFromStore(env), []);
            }
        );
    }
);
