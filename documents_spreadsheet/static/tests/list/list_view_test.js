/** @odoo-module */

import * as spreadsheet from "@odoo/o-spreadsheet";
import { insertList } from "@spreadsheet_edition/bundle/list/list_init_callback";
import { InsertListSpreadsheetMenu } from "@spreadsheet_edition/assets/list_view/insert_list_spreadsheet_menu_owl";
import { selectCell, setCellContent } from "@spreadsheet/../tests/utils/commands";
import { getBasicData, getBasicServerData } from "@spreadsheet/../tests/utils/data";
import {
    getCellFormula,
    getEvaluatedCell,
    getCellValue,
} from "@spreadsheet/../tests/utils/getters";
import {
    patchUserContextWithCleanup,
    patchUserWithCleanup,
} from "@web/../tests/helpers/mock_services";
import {
    click,
    getFixture,
    nextTick,
    patchWithCleanup,
    patchDate,
    editInput,
    makeDeferred,
    triggerEvent,
} from "@web/../tests/helpers/utils";
import { toggleActionMenu, pagerNext } from "@web/../tests/search/helpers";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";
import { registry } from "@web/core/registry";
import { ListRenderer } from "@web/views/list/list_renderer";
import { ListController } from "@web/views/list/list_controller";
import {
    createSpreadsheetFromListView,
    spawnListViewForSpreadsheet,
    invokeInsertListInSpreadsheetDialog,
} from "../utils/list_helpers";
import { createSpreadsheet } from "../spreadsheet_test_utils.js";
import { doMenuAction, getActionMenu } from "@spreadsheet/../tests/utils/ui";

import { user } from "@web/core/user";
import { session } from "@web/session";
import * as dsHelpers from "@web/../tests/core/domain_selector_tests";
import { insertListInSpreadsheet } from "@spreadsheet/../tests/utils/list";
import { SpreadsheetAction } from "../../src/bundle/actions/spreadsheet_action";
import { getSpreadsheetActionModel } from "@spreadsheet_edition/../tests/utils/webclient_helpers";
import { patchListControllerExportSelection } from "@spreadsheet_edition/assets/list_view/list_controller";
import { waitForDataLoaded } from "@spreadsheet/helpers/model";
import { onMounted } from "@odoo/owl";
import { getHighlightsFromStore } from "../utils/store_helpers";
import { getZoneOfInsertedDataSource } from "@spreadsheet/../tests/utils/pivot";

const { topbarMenuRegistry, cellMenuRegistry } = spreadsheet.registries;
const { toZone } = spreadsheet.helpers;

QUnit.module(
    "documents_spreadsheet > list view",
    {
        beforeEach: () => {
            patchWithCleanup(ListController.prototype, patchListControllerExportSelection);
        },
    },
    () => {
        QUnit.test("List export with a invisible field", async (assert) => {
            const { model } = await createSpreadsheetFromListView({
                serverData: {
                    models: getBasicData(),
                    views: {
                        "partner,false,list": `
                        <tree string="Partners">
                            <field name="foo" column_invisible="1"/>
                            <field name="bar"/>
                        </tree>`,
                        "partner,false,search": "<search/>",
                    },
                },
            });
            assert.deepEqual(model.getters.getListDefinition("1").columns, ["bar"]);
        });

        QUnit.test("List export with a widget handle", async (assert) => {
            const { model } = await createSpreadsheetFromListView({
                serverData: {
                    models: getBasicData(),
                    views: {
                        "partner,false,list": `
                            <tree string="Partners">
                                <field name="foo" widget="handle"/>
                                <field name="bar"/>
                            </tree>`,
                        "partner,false,search": "<search/>",
                    },
                },
            });
            assert.deepEqual(model.getters.getListDefinition("1").columns, ["bar"]);
        });

        QUnit.test("property fields are not exported", async (assert) => {
            const data = getBasicData();
            const propertyDefinition = {
                type: "char",
                name: "property_char",
                string: "Property char",
            };
            const product = data.product.records[0];
            product.properties_definitions = [propertyDefinition];
            data.partner.records = [
                {
                    id: 1,
                    bar: true,
                    product_id: product.id,
                    partner_properties: [{ ...propertyDefinition, value: "CHAR" }],
                },
            ];
            const { model } = await createSpreadsheetFromListView({
                actions: async (fixture) => {
                    // display the property which is an optional column
                    await click(fixture, ".o_optional_columns_dropdown_toggle");
                    await click(fixture, ".o-dropdown--menu input[type='checkbox']");
                    assert.containsOnce(
                        fixture,
                        ".o_list_renderer th[data-name='partner_properties.property_char']"
                    );
                    assert.step("display_property");
                },
                serverData: {
                    models: data,
                    views: {
                        "partner,false,list": /*xml*/ `
                        <tree>
                            <field name="product_id"/>
                            <field name="bar"/>
                            <field name="partner_properties"/>
                        </tree>`,
                        "partner,false,search": "<search/>",
                    },
                },
            });
            assert.deepEqual(model.getters.getListDefinition("1").columns, ["product_id", "bar"]);
            assert.verifySteps(["display_property"]);
        });

        QUnit.test("json fields are not exported", async (assert) => {
            const { model } = await createSpreadsheetFromListView({
                serverData: {
                    models: getBasicData(),
                    views: {
                        "partner,false,list": `
                        <tree string="Partners">
                            <field name="jsonField"/>
                            <field name="bar"/>
                        </tree>`,
                        "partner,false,search": "<search/>",
                    },
                },
            });
            assert.deepEqual(model.getters.getListDefinition("1").columns, ["bar"]);
        });

        QUnit.test("Open list properties", async function (assert) {
            const { env } = await createSpreadsheetFromListView();

            await doMenuAction(topbarMenuRegistry, ["data", "item_list_1"], env);
            await nextTick();
            const target = getFixture();
            let title = target.querySelector(".o-sidePanelTitle").innerText;
            assert.equal(title, "List properties");

            const sections = target.querySelectorAll(".o_side_panel_section");
            assert.equal(sections.length, 4, "it should have 4 sections");
            const [pivotName, pivotModel, domain] = sections;

            assert.equal(pivotName.children[0].innerText, "List Name");
            assert.equal(pivotName.children[1].innerText, "(#1) Partners");

            assert.equal(pivotModel.children[0].innerText, "Model");
            assert.equal(pivotModel.children[1].innerText, "Partner (partner)");

            assert.equal(domain.children[0].innerText, "Domain");
            assert.equal(domain.children[1].innerText, "Match all records\nInclude archived");

            env.openSidePanel("ALL_LISTS_PANEL");
            await nextTick();
            title = target.querySelector(".o-sidePanelTitle").innerText;
            assert.equal(title, "List properties");

            assert.containsOnce(target, ".o_side_panel_select");
        });

        QUnit.test(
            "A warning is displayed in the menu item if the list is unused",
            async function (assert) {
                const { model } = await createSpreadsheetFromListView();
                model.dispatch("CREATE_SHEET", { sheetId: "sh2", name: "Sheet2" });
                insertListInSpreadsheet(model, {
                    sheetId: "sh2",
                    model: "product",
                    columns: ["name", "active"],
                });
                const target = getFixture();
                await click(target, "div[data-id='data']");

                const menuItemList1 = target.querySelector("div[data-name='item_list_1']");
                const menuItemList2 = target.querySelector("div[data-name='item_list_2']");
                assert.containsNone(menuItemList1, ".o-unused-list-icon");
                assert.containsNone(menuItemList2, ".o-unused-list-icon");

                model.dispatch("DELETE_SHEET", { sheetId: "sh2" });
                await nextTick();

                assert.containsNone(menuItemList1, ".o-unused-list-icon");
                assert.containsOnce(menuItemList2, ".o-unused-list-icon");
            }
        );

        QUnit.test(
            "A warning is displayed in the side panel if the list is unused",
            async function (assert) {
                const { model, env } = await createSpreadsheetFromListView();
                const target = getFixture();

                const [listId] = model.getters.getListIds();
                env.openSidePanel("LIST_PROPERTIES_PANEL", { listId });
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

        QUnit.test("Deleting the list closes the side panel", async function (assert) {
            const { model, env } = await createSpreadsheetFromListView();
            const [listId] = model.getters.getListIds();
            env.openSidePanel("LIST_PROPERTIES_PANEL", { listId });
            await nextTick();
            const fixture = getFixture();
            const titleSelector = ".o-sidePanelTitle";
            assert.equal(fixture.querySelector(titleSelector).innerText, "List properties");

            model.dispatch("REMOVE_ODOO_LIST", { listId });
            await nextTick();
            assert.equal(fixture.querySelector(titleSelector), null);
        });

        QUnit.test("Undo a list insertion closes the side panel", async function (assert) {
            const { model, env } = await createSpreadsheetFromListView();
            const [listId] = model.getters.getListIds();
            env.openSidePanel("LIST_PROPERTIES_PANEL", { listId });
            await nextTick();
            const fixture = getFixture();
            const titleSelector = ".o-sidePanelTitle";
            assert.equal(fixture.querySelector(titleSelector).innerText, "List properties");

            model.dispatch("REQUEST_UNDO");
            model.dispatch("REQUEST_UNDO");
            await nextTick();
            assert.equal(fixture.querySelector(titleSelector), null);
        });

        QUnit.test("Add list in an existing spreadsheet", async (assert) => {
            const { model } = await createSpreadsheetFromListView();
            const list = model.getters.getListDefinition("1");
            const fields = model.getters.getListDataSource("1").getFields();
            const callback = insertList.bind({ isEmptySpreadsheet: false })({
                list: list,
                threshold: 10,
                fields: fields,
            });
            model.dispatch("CREATE_SHEET", { sheetId: "42", position: 1 });
            const activeSheetId = model.getters.getActiveSheetId();
            assert.deepEqual(model.getters.getSheetIds(), [activeSheetId, "42"]);
            await callback(model);
            assert.strictEqual(model.getters.getSheetIds().length, 3);
            assert.deepEqual(model.getters.getSheetIds()[0], activeSheetId);
            assert.deepEqual(model.getters.getSheetIds()[1], "42");
        });

        QUnit.test("Verify absence of list properties on non-list cell", async function (assert) {
            const { model, env } = await createSpreadsheetFromListView();
            selectCell(model, "Z26");
            const root = cellMenuRegistry.getAll().find((item) => item.id === "listing_properties");
            assert.notOk(root.isVisible(env));
        });

        QUnit.test(
            "Verify absence of list properties on formula with invalid list Id",
            async function (assert) {
                const { model, env } = await createSpreadsheetFromListView();
                setCellContent(model, "A1", `=ODOO.LIST.HEADER("fakeId", "foo")`);
                const root = cellMenuRegistry
                    .getAll()
                    .find((item) => item.id === "listing_properties");
                assert.notOk(root.isVisible(env));
                setCellContent(model, "A1", `=ODOO.LIST("fakeId", "2", "bar")`);
                assert.notOk(root.isVisible(env));
            }
        );

        QUnit.test("Re-insert a list correctly ask for lines number", async function (assert) {
            const { model, env, fixture } = await createSpreadsheetFromListView();
            selectCell(model, "Z26");
            await doMenuAction(
                topbarMenuRegistry,
                ["data", "reinsert_list", "reinsert_list_1"],
                env
            );
            await nextTick();
            /** @type {HTMLInputElement} */
            const input = fixture.querySelector(".modal-body input");
            assert.ok(input);
            assert.strictEqual(input.type, "number");

            await click(fixture, ".o_dialog .btn-secondary"); // cancel
            assert.strictEqual(getCellFormula(model, "Z26"), "", "the list is not re-inserted");

            await doMenuAction(
                topbarMenuRegistry,
                ["data", "reinsert_list", "reinsert_list_1"],
                env
            );
            await nextTick();
            await click(fixture, ".o_dialog .btn-primary"); // confirm
            assert.strictEqual(
                getCellFormula(model, "Z26"),
                '=ODOO.LIST.HEADER(1,"foo")',
                "the list is re-inserted"
            );
        });

        QUnit.test("user related context is not saved in the spreadsheet", async function (assert) {
            setupViewRegistries();

            registry.category("favoriteMenu").add(
                "insert-list-spreadsheet-menu",
                {
                    Component: InsertListSpreadsheetMenu,
                    groupNumber: 4,
                },
                { sequence: 5 }
            );

            patchWithCleanup(ListRenderer.prototype, {
                async getListForSpreadsheet() {
                    const result = await super.getListForSpreadsheet(...arguments);
                    assert.deepEqual(
                        result.list.context,
                        {
                            default_stage_id: 5,
                        },
                        "user related context is not stored in context"
                    );
                    return result;
                },
            });

            const testSession = {
                user_companies: {
                    allowed_companies: {
                        15: { id: 15, name: "Hermit" },
                    },
                    current_company: 15,
                },
            };
            patchWithCleanup(session, testSession);
            patchUserContextWithCleanup({
                allowed_company_ids: [15],
                tz: "bx",
                lang: "FR",
                uid: 4,
            });
            patchUserWithCleanup({ userId: 4 });
            const context = {
                ...user.context,
                default_stage_id: 5,
            };
            const serverData = { models: getBasicData() };
            const { env } = await makeView({
                serverData,
                type: "list",
                resModel: "partner",
                context,
                arch: `
                <tree string="Partners">
                    <field name="bar"/>
                    <field name="product_id"/>
                </tree>
            `,
                config: {
                    actionType: "ir.actions.act_window",
                    getDisplayName: () => "Test",
                    viewType: "list",
                },
            });
            const target = getFixture();
            await invokeInsertListInSpreadsheetDialog(env);
            await click(target, ".modal button.btn-primary");
        });

        QUnit.test(
            "Selected records from current page are inserted correctly",
            async function (assert) {
                assert.expect(2);
                const def = makeDeferred();
                let spreadsheetAction = {};
                patchWithCleanup(SpreadsheetAction.prototype, {
                    setup() {
                        super.setup();
                        onMounted(() => {
                            spreadsheetAction = this;
                            def.resolve();
                        });
                    },
                });
                const serverData = {
                    models: getBasicData(),
                    views: {
                        "partner,false,list": `
                    <tree limit="2">
                        <field name="foo"/>
                    </tree>`,
                        "partner,false,search": "<search/>",
                    },
                };
                await spawnListViewForSpreadsheet({
                    serverData,
                });

                /** Insert the selected records from current page in a new spreadsheet */
                const target = getFixture();
                await click(target.querySelectorAll("td.o_list_record_selector input")[1]);
                await pagerNext(target);
                await click(target.querySelectorAll("td.o_list_record_selector input")[0]);
                await toggleActionMenu(target);
                const insertMenuItem = [
                    ...target.querySelectorAll(".o-dropdown--menu .o_menu_item"),
                ].filter((el) => el.innerText === "Insert in spreadsheet")[0];
                await click(insertMenuItem);
                await click(
                    document.querySelector(".modal-content > .modal-footer > .btn-primary")
                );

                await def;
                const model = getSpreadsheetActionModel(spreadsheetAction);
                await waitForDataLoaded(model);
                assert.strictEqual(
                    getCellValue(model, "A2"),
                    17,
                    "First record from page 2 (i.e. 3 of 4 records) should be inserted"
                );
                assert.strictEqual(getCellValue(model, "A3"), null);
            }
        );

        QUnit.test(
            "Selected all records from current page are inserted correctly",
            async function (assert) {
                assert.expect(4);
                const def = makeDeferred();
                let spreadsheetAction = {};
                patchWithCleanup(SpreadsheetAction.prototype, {
                    setup() {
                        super.setup();
                        onMounted(() => {
                            spreadsheetAction = this;
                            def.resolve();
                        });
                    },
                });
                const serverData = {
                    models: getBasicData(),
                    views: {
                        "partner,false,list": `
                    <tree limit="2">
                        <field name="foo"/>
                    </tree>`,
                        "partner,false,search": "<search/>",
                    },
                };
                await spawnListViewForSpreadsheet({
                    serverData,
                });

                /** Insert the selected records from current page in a new spreadsheet */
                const target = getFixture();
                await click(target.querySelectorAll("td.o_list_record_selector input")[1]);
                await click(target.querySelectorAll("td.o_list_record_selector input")[0]);
                await click(target.querySelector(".o_list_select_domain"));
                await toggleActionMenu(target);
                const insertMenuItem = [
                    ...target.querySelectorAll(".o-dropdown--menu .o_menu_item"),
                ].filter((el) => el.innerText === "Insert in spreadsheet")[0];
                await click(insertMenuItem);
                await click(
                    document.querySelector(".modal-content > .modal-footer > .btn-primary")
                );

                await def;
                const model = getSpreadsheetActionModel(spreadsheetAction);
                await waitForDataLoaded(model);
                assert.strictEqual(
                    getCellValue(model, "A2"),
                    12,
                    "First record from page 2 (i.e. 3 of 4 records) should be inserted"
                );
                assert.strictEqual(getCellValue(model, "A3"), 1);
                assert.strictEqual(getCellValue(model, "A4"), 17);
                assert.strictEqual(getCellValue(model, "A5"), 2);
            }
        );

        QUnit.test("Can see record of a list", async function (assert) {
            const { webClient, model } = await createSpreadsheetFromListView();
            const listId = model.getters.getListIds()[0];
            const dataSource = model.getters.getListDataSource(listId);
            const env = {
                ...webClient.env,
                model,
                services: {
                    ...model.config.custom.env.services,
                    action: {
                        doAction: (params) => {
                            assert.step(params.res_model);
                            assert.step(params.res_id.toString());
                        },
                    },
                },
            };
            selectCell(model, "A2");
            const root = cellMenuRegistry.getAll().find((item) => item.id === "list_see_record");
            await root.execute(env);
            assert.verifySteps(["partner", dataSource.getIdFromPosition(0).toString()]);

            selectCell(model, "A3");
            await root.execute(env);
            assert.verifySteps(["partner", dataSource.getIdFromPosition(1).toString()]);

            // From a cell inside a merge
            model.dispatch("ADD_MERGE", {
                sheetId: model.getters.getActiveSheetId(),
                target: [toZone("A3:B3")],
                force: true, // there are data in B3
            });
            selectCell(model, "B3");
            await root.execute(env);
            assert.verifySteps(["partner", dataSource.getIdFromPosition(1).toString()]);
        });

        QUnit.test(
            "See record of list is only displayed on list formula with only one list formula",
            async function (assert) {
                const { webClient, model } = await createSpreadsheetFromListView();
                const env = {
                    ...webClient.env,
                    model,
                    services: model.config.custom.env.services,
                };
                setCellContent(model, "A1", "test");
                setCellContent(model, "A2", `=ODOO.LIST("1","1","foo")`);
                setCellContent(model, "A3", `=ODOO.LIST("1","1","foo")+LIST("1","1","foo")`);
                const root = cellMenuRegistry
                    .getAll()
                    .find((item) => item.id === "list_see_record");

                selectCell(model, "A1");
                assert.strictEqual(root.isVisible(env), false);
                selectCell(model, "A2");
                assert.strictEqual(root.isVisible(env), true);
                selectCell(model, "A3");
                assert.strictEqual(root.isVisible(env), false);
            }
        );

        QUnit.test(
            "See records is visible even if the formula is lowercase",
            async function (assert) {
                const { env, model } = await createSpreadsheetFromListView();
                selectCell(model, "B2");
                const root = cellMenuRegistry
                    .getAll()
                    .find((item) => item.id === "list_see_record");
                assert.ok(root.isVisible(env));
                setCellContent(
                    model,
                    "B2",
                    getCellFormula(model, "B2").replace("ODOO.LIST", "odoo.list")
                );
                assert.ok(root.isVisible(env));
            }
        );

        QUnit.test(
            "See records is not visible if the formula is in error",
            async function (assert) {
                const { env, model } = await createSpreadsheetFromListView();
                selectCell(model, "B2");
                const root = cellMenuRegistry
                    .getAll()
                    .find((item) => item.id === "list_see_record");
                assert.ok(root.isVisible(env));
                setCellContent(
                    model,
                    "B2",
                    getCellFormula(model, "B2").replace(`ODOO.LIST(1`, `ODOO.LIST("5)`)
                ); //Invalid id
                assert.ok(getEvaluatedCell(model, "B2").message);
                assert.notOk(root.isVisible(env));
            }
        );

        QUnit.test("See record.isVisible() don't throw on spread values", async function (assert) {
            const { env, model } = await createSpreadsheet();
            setCellContent(model, "A1", "A1");
            setCellContent(model, "A2", "A2");
            setCellContent(model, "C1", "=TRANSPOSE(A1:A2)");
            selectCell(model, "D1");
            await nextTick();
            const root = cellMenuRegistry.getAll().find((item) => item.id === "list_see_record");
            assert.notOk(root.isVisible(env));
        });

        QUnit.test("Cannot see record of list formula without value", async function (assert) {
            const { env, model } = await createSpreadsheetFromListView();
            assert.strictEqual(getCellFormula(model, "A6"), `=ODOO.LIST(1,5,"foo")`);
            assert.strictEqual(getCellValue(model, "A6"), "", "A6 is empty");
            selectCell(model, "A6");
            const action = await getActionMenu(cellMenuRegistry, ["list_see_record"], env);
            assert.notOk(action.isVisible(env));
        });

        QUnit.test(
            "'See records' loads a specific action if set in the list definition",
            async function (assert) {
                const { actions } = getBasicServerData();
                const { xml_id: actionXmlId } = Object.values(actions)[0];
                const { webClient, model } = await createSpreadsheetFromListView({ actionXmlId });
                const actionService = webClient.env.services.action;
                const env = {
                    ...webClient.env,
                    model,
                    services: {
                        ...model.config.custom.env.services,
                        action: {
                            ...actionService,
                            doAction: (params) => {
                                assert.ok(params.id);
                                assert.ok(params.xml_id);
                                assert.step(params.res_model);
                                assert.step(params.res_id.toString());
                            },
                        },
                    },
                };
                selectCell(model, "C3");
                await nextTick();
                const root = cellMenuRegistry
                    .getAll()
                    .find((item) => item.id === "list_see_record");
                await root.execute(env);
                assert.verifySteps(["partner", "2"]);
            }
        );

        QUnit.test("Update the list title from the side panel", async function (assert) {
            const { model, env, fixture } = await createSpreadsheetFromListView();
            const [listId] = model.getters.getListIds();
            env.openSidePanel("LIST_PROPERTIES_PANEL", { listId });
            await nextTick();
            await click(fixture, ".o_sp_en_rename");
            editInput(fixture, ".o_sp_en_name", "new name");
            await click(fixture, ".o_sp_en_save");
            assert.equal(model.getters.getListName(listId), "new name");
        });

        QUnit.test("list with a contextual domain", async (assert) => {
            // TODO: the date is coded at 12PM so the test won't fail if the timezone is not UTC. It will still fail on some
            // timezones (GMT +13). The good way to do the test would be to patch the time zone and the date correctly.
            // But PyDate uses new Date() instead of luxon, which cannot be correctly patched.
            patchDate(2016, 4, 14, 12, 0, 0);
            const serverData = getBasicServerData();
            serverData.models.partner.records = [
                {
                    id: 1,
                    probability: 0.5,
                    date: "2016-05-14",
                },
            ];
            serverData.views["partner,false,search"] = /* xml */ `
            <search>
                <filter string="Filter" name="filter" domain="[('date', '=', context_today())]"/>
            </search>
        `;
            serverData.views["partner,false,list"] = /* xml */ `
            <tree>
                <field name="foo"/>
            </tree>
        `;
            const { model } = await createSpreadsheetFromListView({
                serverData,
                additionalContext: { search_default_filter: 1 },
                mockRPC: function (route, args) {
                    if (args.method === "web_search_read") {
                        assert.deepEqual(
                            args.kwargs.domain,
                            [["date", "=", "2016-05-14"]],
                            "data should be fetched with the evaluated the domain"
                        );
                        assert.step("web_search_read");
                    }
                },
            });
            const listId = "1";
            assert.deepEqual(
                model.getters.getListDefinition(listId).domain,
                '[("date", "=", context_today())]'
            );
            assert.deepEqual(
                model.exportData().lists[listId].domain,
                '[("date", "=", context_today())]',
                "domain is exported with the dynamic value"
            );
            assert.verifySteps([
                "web_search_read", // list view is loaded
                "web_search_read", // the data is loaded in the spreadsheet
            ]);
        });

        QUnit.test("Update the list domain from the side panel", async function (assert) {
            const { model, env } = await createSpreadsheetFromListView({
                mockRPC(route) {
                    if (route === "/web/domain/validate") {
                        return true;
                    }
                },
            });
            const [listId] = model.getters.getListIds();
            env.openSidePanel("LIST_PROPERTIES_PANEL", { listId });
            await nextTick();
            const fixture = getFixture();
            await click(fixture.querySelector(".o_edit_domain"));
            await dsHelpers.addNewRule(fixture);
            await click(fixture.querySelector(".modal-footer .btn-primary"));
            assert.deepEqual(model.getters.getListDefinition(listId).domain, [["id", "=", 1]]);
            assert.equal(dsHelpers.getConditionText(fixture), "ID = 1");
        });

        QUnit.test(
            "Inserting a list preserves the ascending sorting from the list",
            async function (assert) {
                const serverData = getBasicServerData();
                serverData.models.partner.fields.foo.sortable = true;
                const { model } = await createSpreadsheetFromListView({
                    serverData,
                    orderBy: [{ name: "foo", asc: true }],
                    linesNumber: 4,
                });
                assert.ok(
                    getEvaluatedCell(model, "A2").value <= getEvaluatedCell(model, "A3").value
                );
                assert.ok(
                    getEvaluatedCell(model, "A3").value <= getEvaluatedCell(model, "A4").value
                );
                assert.ok(
                    getEvaluatedCell(model, "A4").value <= getEvaluatedCell(model, "A5").value
                );
            }
        );

        QUnit.test(
            "Inserting a list preserves the descending sorting from the list",
            async function (assert) {
                const serverData = getBasicServerData();
                serverData.models.partner.fields.foo.sortable = true;
                const { model } = await createSpreadsheetFromListView({
                    serverData,
                    orderBy: [{ name: "foo", asc: false }],
                    linesNumber: 4,
                });
                assert.ok(
                    getEvaluatedCell(model, "A2").value >= getEvaluatedCell(model, "A3").value
                );
                assert.ok(
                    getEvaluatedCell(model, "A3").value >= getEvaluatedCell(model, "A4").value
                );
                assert.ok(
                    getEvaluatedCell(model, "A4").value >= getEvaluatedCell(model, "A5").value
                );
            }
        );

        QUnit.test(
            "Sorting from the list is displayed in the properties panel",
            async function (assert) {
                const serverData = getBasicServerData();
                serverData.models.partner.fields.foo.sortable = true;
                serverData.models.partner.fields.bar.sortable = true;
                const { model, env } = await createSpreadsheetFromListView({
                    serverData,
                    orderBy: [
                        { name: "foo", asc: true },
                        { name: "bar", asc: false },
                    ],
                    linesNumber: 4,
                });
                const [listId] = model.getters.getListIds();
                env.openSidePanel("LIST_PROPERTIES_PANEL", { listId });
                await nextTick();
                const fixture = getFixture();
                const sortingSection = fixture.querySelectorAll(".o_side_panel_section")[3];
                const barSortingText = sortingSection.querySelectorAll("div")[1].innerText;
                const fooSortingText = sortingSection.querySelectorAll("div")[2].innerText;
                assert.strictEqual(barSortingText, "Bar (descending)");
                assert.strictEqual(fooSortingText, "Foo (ascending)");
            }
        );

        QUnit.test(
            "Opening the sidepanel of a list while the panel of another list is open updates the side panel",
            async function (assert) {
                const { model, env } = await createSpreadsheetFromListView({});
                insertListInSpreadsheet(model, {
                    model: "product",
                    columns: ["name", "active"],
                });

                const listIds = model.getters.getListIds();
                const fixture = getFixture();

                env.openSidePanel("LIST_PROPERTIES_PANEL", { listId: listIds[0] });
                await nextTick();
                let modelName = fixture.querySelector(".o_side_panel_section .o_model_name");
                assert.equal(modelName.innerText, "Partner (partner)");

                env.openSidePanel("LIST_PROPERTIES_PANEL", { listId: listIds[1] });
                await nextTick();
                modelName = fixture.querySelector(".o_side_panel_section .o_model_name");
                assert.equal(modelName.innerText, "Product (product)");
            }
        );

        QUnit.test("Duplicate a list from the side panel", async function (assert) {
            const serverData = getBasicServerData();
            serverData.models.partner.fields.foo.sortable = true;
            const { model, env } = await createSpreadsheetFromListView({
                serverData,
                orderBy: [{ name: "foo", asc: true }],
            });
            const fixture = getFixture();
            const [listId] = model.getters.getListIds();
            env.openSidePanel("LIST_PROPERTIES_PANEL", { listId });
            await nextTick();

            assert.equal(model.getters.getListIds().length, 1);
            assert.equal(
                fixture.querySelector(".o_sp_en_display_name").innerText,
                "(#1) Partners by Foo"
            );

            await click(fixture, ".o_duplicate_list");
            assert.equal(model.getters.getListIds().length, 2);
            assert.equal(
                fixture.querySelector(".o_sp_en_display_name").innerText,
                "(#2) Partners by Foo"
            );
        });

        QUnit.test("List export from an action with an xml ID", async function (assert) {
            const { actions } = getBasicServerData();
            const { xml_id: actionXmlId } = Object.values(actions)[0];
            const { model } = await createSpreadsheetFromListView({ actionXmlId });
            assert.deepEqual(
                model.getters.getListDefinition("1").actionXmlId,
                "spreadsheet.partner_action"
            );
        });

        QUnit.test(
            "List cells are highlighted when their side panel is open",
            async function (assert) {
                const { model, env } = await createSpreadsheetFromListView();
                const fixture = getFixture();
                const sheetId = model.getters.getActiveSheetId();
                env.openSidePanel("LIST_PROPERTIES_PANEL", { listId: "1" });
                await nextTick();

                const zone = getZoneOfInsertedDataSource(model, "list", "1");
                assert.deepEqual(getHighlightsFromStore(env), [{ sheetId, zone, noFill: true }]);
                await click(fixture, ".o-sidePanelClose");
                assert.deepEqual(getHighlightsFromStore(env), []);
            }
        );

        QUnit.test(
            "List cells are highlighted when hovering the list menu item",
            async function (assert) {
                const { model, env } = await createSpreadsheetFromListView();
                const fixture = getFixture();
                const sheetId = model.getters.getActiveSheetId();
                await click(fixture, ".o-topbar-top div[data-id='data']");

                triggerEvent(fixture, "div[data-name='item_list_1']", "mouseenter");
                const zone = getZoneOfInsertedDataSource(model, "list", "1");
                assert.deepEqual(getHighlightsFromStore(env), [{ sheetId, zone, noFill: true }]);

                triggerEvent(fixture, "div[data-name='item_list_1']", "mouseleave");
                assert.deepEqual(getHighlightsFromStore(env), []);
            }
        );

        QUnit.test(
            "List cells are highlighted when hovering the list in the list of lists side panel",
            async function (assert) {
                const { model, env } = await createSpreadsheetFromListView();
                const fixture = getFixture();
                const sheetId = model.getters.getActiveSheetId();
                env.openSidePanel("ALL_LISTS_PANEL");
                await nextTick();

                assert.deepEqual(getHighlightsFromStore(env), []);

                triggerEvent(fixture, ".o_side_panel_select", "mouseenter");
                const zone = getZoneOfInsertedDataSource(model, "list", "1");
                assert.deepEqual(getHighlightsFromStore(env), [{ sheetId, zone, noFill: true }]);

                triggerEvent(fixture, ".o_side_panel_select", "mouseleave");
                assert.deepEqual(getHighlightsFromStore(env), []);
            }
        );
    }
);
