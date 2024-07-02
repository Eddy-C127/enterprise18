import { defineDocumentSpreadsheetModels } from "@documents_spreadsheet/../tests/helpers/data";
import { getEnrichedSearchArch } from "@documents_spreadsheet/../tests/helpers/document_helpers";
import { mockActionService } from "@documents_spreadsheet/../tests/helpers/spreadsheet_test_utils";
import { beforeEach, describe, expect, getFixture, test } from "@odoo/hoot";
import { click, dblclick } from "@odoo/hoot-dom";
import { animationFrame } from "@odoo/hoot-mock";
import { makeSpreadsheetMockEnv } from "@spreadsheet/../tests/helpers/model";
import { contains, mountView } from "@web/../tests/web_test_helpers";

describe.current.tags("desktop");
defineDocumentSpreadsheetModels();

const kanbanArch = /* xml */ `
    <kanban js_class="documents_kanban">
        <templates>
            <t t-name="kanban-box">
                <div><field name="name"/></div>
            </t>
        </templates>
    </kanban>`;

const TEST_TEMPLATES = [
    { id: 3, name: "Template 3", spreadsheet_data: "{}" },
    { id: 4, name: "Template 4", spreadsheet_data: "{}" },
    { id: 5, name: "Template 5", spreadsheet_data: "{}" },
    { id: 6, name: "Template 6", spreadsheet_data: "{}" },
    { id: 7, name: "Template 7", spreadsheet_data: "{}" },
    { id: 8, name: "Template 8", spreadsheet_data: "{}" },
    { id: 9, name: "Template 9", spreadsheet_data: "{}" },
    { id: 10, name: "Template 10", spreadsheet_data: "{}" },
    { id: 11, name: "Template 11", spreadsheet_data: "{}" },
    { id: 12, name: "Template 12", spreadsheet_data: "{}" },
];

function getDocumentBasicData(views = {}) {
    const models = {};
    models["documents.folder"] = {
        records: [{ name: "Workspace1", description: "Workspace", has_write_access: true, id: 1 }],
    };
    models["mail.alias"] = { records: [{ alias_name: "hazard@rmcf.es", id: 1 }] };
    models["documents.share"] = {
        records: [{ name: "Share1", folder_id: 1, alias_id: 1 }],
    };
    models["spreadsheet.template"] = {
        records: [
            { id: 1, name: "Template 1", spreadsheet_data: "{}" },
            { id: 2, name: "Template 2", spreadsheet_data: "{}" },
        ],
    };
    return {
        models,
        views,
    };
}

/**
 * @typedef InitArgs
 * @property {Object} [serverData]
 * @property {Array} [additionalTemplates]
 * @property {Function} [mockRPC]
 */

/**
 *  @param {InitArgs} args
 */
async function initTestEnvWithKanban(args = {}) {
    const data = args.serverData || getDocumentBasicData({});
    data.models["spreadsheet.template"].records = data.models[
        "spreadsheet.template"
    ].records.concat(args.additionalTemplates || []);
    await makeSpreadsheetMockEnv({ ...args, serverData: data });
    return await mountView({
        type: "kanban",
        resModel: "documents.document",
        arch: kanbanArch,
        searchViewArch: getEnrichedSearchArch(),
    });
}

/**
 *  @param {InitArgs} params
 */
async function initTestEnvWithBlankSpreadsheet(params = {}) {
    const serverData = getDocumentBasicData();
    serverData.models["documents.folder"] = {
        records: [{ name: "Workspace1", description: "Workspace", has_write_access: true, id: 1 }],
    };
    serverData.models["documents.document"] = {
        record: [
            {
                name: "My spreadsheet",
                spreadsheet_data: "{}",
                is_favorited: false,
                folder_id: 1,
                handler: "spreadsheet",
            },
        ],
    };
    return await initTestEnvWithKanban({ serverData, ...params });
}

let target;

beforeEach(() => {
    target = getFixture();
});

test("Create spreadsheet from kanban view opens a modal", async function () {
    await initTestEnvWithKanban();
    const menu = target.querySelector(".o_control_panel .btn-group");
    await contains(menu.querySelector(".dropdown-toggle")).click();
    await contains(menu.querySelector(".o_documents_kanban_spreadsheet")).click();
    expect(".o-spreadsheet-templates-dialog").toHaveCount(1, {
        message: "should have opened the template modal",
    });
    expect(".o-spreadsheet-templates-dialog .modal-body .o_searchview").toHaveCount(1, {
        message: "The Modal should have a search view",
    });
});

test("Create spreadsheet from list view opens a modal", async function () {
    const serverData = getDocumentBasicData();
    await makeSpreadsheetMockEnv({ serverData });
    await mountView({
        resModel: "documents.document",
        type: "list",
        arch: `<tree js_class="documents_list"></tree>`,
        searchViewArch: getEnrichedSearchArch(),
    });
    const menu = target.querySelector(".o_control_panel .btn-group");
    await contains(menu.querySelector(".dropdown-toggle")).click();
    await contains(menu.querySelector(".o_documents_kanban_spreadsheet")).click();
    expect(".o-spreadsheet-templates-dialog").toHaveCount(1, {
        message: "should have opened the template modal",
    });
    expect(".o-spreadsheet-templates-dialog .modal-body .o_searchview").toHaveCount(1, {
        message: "The Modal should have a search view",
    });
});

test("Can search template in modal with searchbar", async function () {
    await initTestEnvWithKanban();
    const menu = target.querySelector(".o_control_panel .btn-group");
    await contains(menu.querySelector(".dropdown-toggle")).click();
    await contains(menu.querySelector(".o_documents_kanban_spreadsheet")).click();
    const dialog = target.querySelector(".o-spreadsheet-templates-dialog");
    expect(
        dialog.querySelectorAll(".o-spreadsheet-grid:not(.o-spreadsheet-grid-ghost-item)").length
    ).toBe(3);
    expect(dialog.querySelector(".o-spreadsheet-grid")).toHaveText("Blank spreadsheet");

    const searchInput = dialog.querySelector(".o_searchview_input");
    await contains(searchInput).edit("Template 1");
    expect(
        dialog.querySelectorAll(".o-spreadsheet-grid:not(.o-spreadsheet-grid-ghost-item)").length
    ).toBe(2);
    expect(dialog.querySelector(".o-spreadsheet-grid")).toHaveText("Blank spreadsheet");
});

test("Can fetch next templates", async function () {
    let fetch = 0;
    const mockRPC = async function (route, args) {
        if (args.method === "web_search_read" && args.model === "spreadsheet.template") {
            fetch++;
            expect(args.kwargs.limit).toBe(9);
            expect.step("fetch_templates");
            if (fetch === 1) {
                expect(args.kwargs.offset).toBe(0);
            } else if (fetch === 2) {
                expect(args.kwargs.offset).toBe(9);
            }
        }
        if (args.method === "search_read" && args.model === "ir.model") {
            return [{ name: "partner" }];
        }
    };
    await initTestEnvWithKanban({ additionalTemplates: TEST_TEMPLATES, mockRPC });

    const menu = target.querySelector(".o_control_panel .btn-group");
    await contains(menu.querySelector(".dropdown-toggle")).click();
    await contains(menu.querySelector(".o_documents_kanban_spreadsheet")).click();
    const dialog = document.querySelector(".o-spreadsheet-templates-dialog");

    expect(
        dialog.querySelectorAll(".o-spreadsheet-grid:not(.o-spreadsheet-grid-ghost-item)").length
    ).toBe(10);
    await contains(dialog.querySelector(".o_pager_next")).click();
    expect.verifySteps(["fetch_templates", "fetch_templates"]);
});

test("Disable create button if no template is selected", async function () {
    await initTestEnvWithKanban({ additionalTemplates: TEST_TEMPLATES });
    // open template dialog
    const menu = target.querySelector(".o_control_panel .btn-group");
    await contains(menu.querySelector(".dropdown-toggle")).click();
    await contains(menu.querySelector(".o_documents_kanban_spreadsheet")).click();
    const dialog = document.querySelector(".o-spreadsheet-templates-dialog");

    // select template
    click(dialog.querySelectorAll(".o-spreadsheet-grid-image")[1]);

    // change page; no template should be selected
    await contains(dialog.querySelector(".o_pager_next")).click();
    expect(".o-spreadsheet-grid-selected").toHaveCount(0);
    const createButton = dialog.querySelector(".o-spreadsheet-create");
    expect(createButton).toHaveProperty("disabled", true);
});

test("Can create a blank spreadsheet from template dialog", async function () {
    const mockDoAction = (action) => {
        expect.step("redirect");
        expect(action.tag).toBe("action_open_spreadsheet");
    };
    await initTestEnvWithBlankSpreadsheet({
        mockRPC: async function (route, args) {
            if (
                args.model === "documents.document" &&
                args.method === "action_open_new_spreadsheet"
            ) {
                expect(args.args[0].folder_id).toBe(1);
                expect.step("action_open_new_spreadsheet");
            }
        },
    });
    mockActionService(mockDoAction);

    // ### With confirm button
    const menu = target.querySelector(".o_control_panel .btn-group");
    await contains(menu.querySelector(".dropdown-toggle")).click();
    await contains(menu.querySelector(".o_documents_kanban_spreadsheet")).click();
    let dialog = document.querySelector(".o-spreadsheet-templates-dialog");
    // select blank spreadsheet
    click(dialog.querySelectorAll(".o-spreadsheet-grid-image")[0]);
    await contains(dialog.querySelector(".o-spreadsheet-create")).click();
    expect.verifySteps(["action_open_new_spreadsheet", "redirect"]);

    // ### With double click on image
    await contains(menu.querySelector(".dropdown-toggle")).click();
    await contains(menu.querySelector(".o_documents_kanban_spreadsheet")).click();
    dialog = document.querySelector(".o-spreadsheet-templates-dialog");
    click(dialog.querySelectorAll(".o-spreadsheet-grid-image")[0]);
    dblclick(dialog.querySelectorAll(".o-spreadsheet-grid-image")[0]);
    await animationFrame();
    expect.verifySteps(["action_open_new_spreadsheet", "redirect"]);
});

test("Context is transmitted when creating spreadsheet", async function () {
    const serverData = await getDocumentBasicData({
        "documents.document,false,kanban": `
                <kanban js_class="documents_kanban"><templates><t t-name="kanban-box">
                <div><field name="name"/></div>
                </t></templates></kanban>
                `,
        "documents.document,false,search": getEnrichedSearchArch(),
    });
    await makeSpreadsheetMockEnv({
        mockRPC: async function (route, args) {
            if (args.method === "action_open_new_spreadsheet") {
                expect.step("action_open_new_spreadsheet");
                expect(args.kwargs.context.default_res_id).toBe(42);
                expect(args.kwargs.context.default_res_model).toBe("test.model");
            }
        },
        serverData,
    });
    await mountView({
        context: {
            default_res_model: "test.model",
            default_res_id: 42,
        },
        resModel: "documents.document",
        type: "kanban",
        searchViewArch: getEnrichedSearchArch(),
        arch: kanbanArch,
    });

    const menu = target.querySelector(".o_control_panel .btn-group");
    await contains(menu.querySelector(".dropdown-toggle")).click();
    await contains(menu.querySelector(".o_documents_kanban_spreadsheet")).click();
    const dialog = document.querySelector(".o-spreadsheet-templates-dialog");
    // select blank spreadsheet
    click(dialog.querySelectorAll(".o-spreadsheet-grid-image")[0]);
    await contains(dialog.querySelector(".o-spreadsheet-create")).click();
    expect.verifySteps(["action_open_new_spreadsheet"]);
});

test("Can create a spreadsheet from a template", async function () {
    const mockDoAction = (action) => {
        expect.step("redirect");
        expect(action.tag).toBe("an_action");
    };
    await initTestEnvWithKanban({
        additionalTemplates: TEST_TEMPLATES,
        mockRPC: async function (route, args) {
            if (
                args.model === "spreadsheet.template" &&
                args.method === "action_create_spreadsheet"
            ) {
                expect.step("action_create_spreadsheet");
                expect(args.args[1].folder_id).toBe(1);
                const action = {
                    type: "ir.actions.client",
                    tag: "an_action",
                };
                return action;
            }
        },
    });
    mockActionService(mockDoAction);

    // ### With confirm button
    const menu = target.querySelector(".o_control_panel .btn-group");
    await contains(menu.querySelector(".dropdown-toggle")).click();
    await contains(menu.querySelector(".o_documents_kanban_spreadsheet")).click();
    let dialog = document.querySelector(".o-spreadsheet-templates-dialog");
    click(dialog.querySelectorAll(".o-spreadsheet-grid-image")[1]);
    await contains(dialog.querySelector(".o-spreadsheet-create")).click();
    expect.verifySteps(["action_create_spreadsheet", "redirect"]);

    // ### With double click on image
    await contains(menu.querySelector(".dropdown-toggle")).click();
    await contains(menu.querySelector(".o_documents_kanban_spreadsheet")).click();
    dialog = document.querySelector(".o-spreadsheet-templates-dialog");
    click(dialog.querySelectorAll(".o-spreadsheet-grid-image")[1]);
    dblclick(dialog.querySelectorAll(".o-spreadsheet-grid-image")[1]);
    await animationFrame();
    expect.verifySteps(["action_create_spreadsheet", "redirect"]);
});

test("The workspace selection should not display Trash workspace", async function () {
    await initTestEnvWithKanban();
    const menu = target.querySelector(".o_control_panel .btn-group");
    await contains(".o_search_panel_category_value:nth-of-type(1) header").click();
    await contains(menu.querySelector(".dropdown-toggle")).click();
    await contains(menu.querySelector(".o_documents_kanban_spreadsheet")).click();
    const selection = target.querySelector(".o-spreadsheet-templates-dialog select");
    expect([...selection.options].find((option) => option.value === "TRASH")).toBe(undefined, {
        message: "Trash workspace should not be present in the selection",
    });
});

test("Offset reset to zero after searching for template in template dialog", async function () {
    const mockRPC = async function (route, args) {
        if (args.method === "web_search_read" && args.model === "spreadsheet.template") {
            expect.step(
                JSON.stringify({
                    offset: args.kwargs.offset,
                    limit: args.kwargs.limit,
                })
            );
        }
    };

    await initTestEnvWithKanban({ additionalTemplates: TEST_TEMPLATES, mockRPC });

    const menu = target.querySelector(".o_control_panel .btn-group");
    await contains(menu.querySelector(".dropdown-toggle")).click();
    await contains(menu.querySelector(".o_documents_kanban_spreadsheet")).click();
    const dialog = document.querySelector(".o-spreadsheet-templates-dialog");

    expect(
        dialog.querySelectorAll(".o-spreadsheet-grid:not(.o-spreadsheet-grid-ghost-item)").length
    ).toBe(10);
    await contains(dialog.querySelector(".o_pager_next")).click();
    expect.verifySteps([
        JSON.stringify({ offset: 0, limit: 9 }),
        JSON.stringify({ offset: 9, limit: 9 }),
    ]);

    const searchInput = dialog.querySelector(".o_searchview_input");
    await contains(searchInput).edit("Template 1");
    await animationFrame();
    await animationFrame();

    expect(
        dialog.querySelectorAll(".o-spreadsheet-grid:not(.o-spreadsheet-grid-ghost-item)").length
    ).toBe(5); // Blank template, Template 1, Template 10, Template 11, Template 12
    expect.verifySteps([JSON.stringify({ offset: 0, limit: 9 })]);
    expect(dialog.querySelector(".o_pager_value")).toHaveText("1-4", {
        message: "Pager should be reset to 1-4 after searching for a template",
    });
});

test("Can navigate through templates with keyboard", async function () {
    await initTestEnvWithKanban({ additionalTemplates: TEST_TEMPLATES });

    // Open template dialog
    const menu = target.querySelector(".o_control_panel .btn-group");
    await contains(menu.querySelector(".dropdown-toggle")).click();
    await contains(menu.querySelector(".o_documents_kanban_spreadsheet")).click();
    const dialog = document.querySelector(".o-spreadsheet-templates-dialog");

    const defaultTemplate = dialog.querySelector(
        ".o-spreadsheet-grid.o-blank-spreadsheet-grid .o-spreadsheet-grid-image"
    );
    expect(defaultTemplate).toHaveClass("o-spreadsheet-grid-selected");

    // Navigate to the next template
    await contains(defaultTemplate).press("ArrowRight");
    expect(defaultTemplate).not.toHaveClass("o-spreadsheet-grid-selected");

    const firstTemplate = dialog.querySelector(".o-spreadsheet-grid-image[data-id='1']");
    expect(firstTemplate).toHaveClass("o-spreadsheet-grid-selected");

    // Navigate back to the previous template
    await contains(defaultTemplate).press("ArrowLeft");
    expect(firstTemplate).not.toHaveClass("o-spreadsheet-grid-selected");
    expect(defaultTemplate).toHaveClass("o-spreadsheet-grid-selected");
});
