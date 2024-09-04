import { DocumentsSearchPanel } from "@documents/views/search/documents_search_panel";
import { defineDocumentSpreadsheetModels } from "@documents_spreadsheet/../tests/helpers/data";
import { mockActionService } from "@documents_spreadsheet/../tests/helpers/spreadsheet_test_utils";
import { XLSX_MIME_TYPES } from "@documents_spreadsheet/helpers";
import { beforeEach, describe, expect, getFixture, test } from "@odoo/hoot";
import { animationFrame } from "@odoo/hoot-mock";
import { Model } from "@odoo/o-spreadsheet";
import { makeSpreadsheetMockEnv } from "@spreadsheet/../tests/helpers/model";
import { contains, mountView, patchWithCleanup } from "@web/../tests/web_test_helpers";
import { loadBundle } from "@web/core/assets";
import { browser } from "@web/core/browser/browser";
import { download } from "@web/core/network/download";
import { x2ManyCommands } from "@web/core/orm_service";
import { SearchPanel } from "@web/search/search_panel/search_panel";
import { getEnrichedSearchArch } from "../helpers/document_helpers";

describe.current.tags("desktop");
defineDocumentSpreadsheetModels();

let target;

const basicDocumentKanbanArch = /* xml */ `
<kanban js_class="documents_kanban">
    <templates>
        <t t-name="kanban-box">
            <div>
                <div name="document_preview" class="o_kanban_image_wrapper">a thumbnail</div>
                <i class="fa fa-circle o_record_selector" />
                <field name="name" />
                <field name="handler" />
            </div>
        </t>
    </templates>
</kanban>
`;

/**
 * @returns {Object}
 */
function getTestServerData(spreadsheetData = {}) {
    return {
        models: {
            "documents.folder": {
                records: [{ id: 1, name: "Workspace1", has_write_access: true }],
            },
            "documents.document": {
                records: [
                    {
                        name: "My spreadsheet",
                        spreadsheet_data: JSON.stringify(spreadsheetData),
                        is_favorited: false,
                        folder_id: 1,
                        handler: "spreadsheet",
                    },
                ],
            },
        },
    };
}

beforeEach(() => {
    target = getFixture();
    // Due to the search panel allowing double clicking on elements, the base
    // methods have a debounce time in order to not do anything on dblclick.
    // This patch removes those features
    patchWithCleanup(DocumentsSearchPanel.prototype, {
        toggleCategory() {
            return SearchPanel.prototype.toggleCategory.call(this, ...arguments);
        },
        toggleFilterGroup() {
            return SearchPanel.prototype.toggleFilterGroup.call(this, ...arguments);
        },
        toggleFilterValue() {
            return SearchPanel.prototype.toggleFilterValue.call(this, ...arguments);
        },
    });
});

test("download spreadsheet from the document inspector", async function () {
    const serverData = getTestServerData();
    await makeSpreadsheetMockEnv({ serverData });
    patchWithCleanup(download, {
        _download: async (options) => {
            expect.step(options.url);
            expect(options.data.zip_name).toBe("My spreadsheet.xlsx");
            expect(options.data.files).not.toBe(undefined);
        },
    });
    await mountView({
        type: "kanban",
        resModel: "documents.document",
        arch: basicDocumentKanbanArch,
        searchViewArch: getEnrichedSearchArch(),
    });

    await contains(".o_kanban_record:nth-of-type(1) .o_record_selector").click();
    await contains("button.o_inspector_download").click();
    await animationFrame();
    expect.verifySteps(["/spreadsheet/xlsx"]);
});
test("share spreadsheet from the document inspector", async function () {
    const model = new Model();
    const serverData = getTestServerData(model.exportData());
    await makeSpreadsheetMockEnv({
        serverData,
        mockRPC: async (route, args) => {
            if (args.method === "action_get_share_url") {
                expect.step("spreadsheet_shared");
                const [shareVals] = args.args;
                expect(args.model).toBe("documents.share");
                const excel = JSON.parse(JSON.stringify(model.exportXLSX().files));
                expect(shareVals).toEqual({
                    document_ids: [x2ManyCommands.set([1])],
                    folder_id: 1,
                    type: "ids",
                    spreadsheet_shares: JSON.stringify([
                        {
                            spreadsheet_data: JSON.stringify(model.exportData()),
                            excel_files: excel,
                            document_id: 1,
                        },
                    ]),
                });
                return "localhost:8069/share/url/132465";
            }
        },
    });
    await loadBundle("spreadsheet.o_spreadsheet");
    patchWithCleanup(browser.navigator.clipboard, {
        writeText: async (url) => {
            expect.step("share url copied");
            expect(url).toBe("localhost:8069/share/url/132465");
        },
    });
    await mountView({
        type: "kanban",
        resModel: "documents.document",
        arch: basicDocumentKanbanArch,
        searchViewArch: getEnrichedSearchArch(),
    });
    await contains(".o_kanban_record:nth-of-type(1) .o_record_selector").click();
    await contains("button.o_inspector_share").click();
    await animationFrame();
    expect(".o_notification:has(.o_notification_bar.bg-success)").toHaveText(
        "The share url has been copied to your clipboard."
    );
    expect.verifySteps(["spreadsheet_shared", "share url copied"]);
});

test("share a selected spreadsheet from the share button", async function () {
    const model = new Model();
    const serverData = getTestServerData(model.exportData());
    await makeSpreadsheetMockEnv({
        serverData,
        mockRPC: async (route, args) => {
            if (args.method === "web_save") {
                expect.step("spreadsheet_shared");
                const shareVals = args.kwargs.context;
                expect(args.model).toBe("documents.share");
                expect(shareVals.default_document_ids).toEqual([x2ManyCommands.set([1])]);
                expect(shareVals.default_folder_id).toBe(1);
                expect(shareVals.default_type).toBe("ids");
                expect(shareVals.default_spreadsheet_shares).toEqual(JSON.stringify([
                    {
                        spreadsheet_data: JSON.stringify(model.exportData()),
                        excel_files: JSON.parse(JSON.stringify(model.exportXLSX().files)),
                        document_id: 1,
                    },
                ]));
            }
        },
    });
    await loadBundle("spreadsheet.o_spreadsheet");
    await mountView({
        type: "kanban",
        resModel: "documents.document",
        arch: basicDocumentKanbanArch,
        searchViewArch: getEnrichedSearchArch(),
    });
    patchWithCleanup(navigator.clipboard, {
        async writeText(text) {
            expect.step("copy");
        },
    });

    await contains(".o_kanban_record:nth-of-type(1) .o_record_selector").click();
    const menu = target.querySelector(".o_control_panel .d-inline-flex");
    await contains(menu.querySelector(".dropdown-toggle")).click();
    await contains(menu.querySelector(".o_documents_kanban_share_domain")).click();
    expect.verifySteps([]);
    await contains(".o_form_button_save").click();
    expect.verifySteps(["spreadsheet_shared", "copy"]);
});

test("share the full workspace from the share button", async function () {
    const model = new Model();
    const serverData = getTestServerData(model.exportData());
    await makeSpreadsheetMockEnv({
        serverData,
        mockRPC: async (route, args) => {
            if (args.method === "web_save") {
                expect.step("spreadsheet_shared");
                const shareVals = args.kwargs.context;
                expect(args.model).toBe("documents.share");
                expect(shareVals.default_folder_id).toBe(1);
                expect(shareVals.default_type).toBe("domain");
                expect(shareVals.default_domain).toEqual([["folder_id", "=", 1]]);
                expect(shareVals.default_spreadsheet_shares).toEqual(JSON.stringify([
                    {
                        spreadsheet_data: JSON.stringify(model.exportData()),
                        excel_files: JSON.parse(JSON.stringify(model.exportXLSX().files)),
                        document_id: 1,
                    },
                ]));
            }
        },
    });
    await loadBundle("spreadsheet.o_spreadsheet");
    await mountView({
        type: "kanban",
        resModel: "documents.document",
        arch: basicDocumentKanbanArch,
        searchViewArch: getEnrichedSearchArch(),
    });
    patchWithCleanup(navigator.clipboard, {
        async writeText() {
            expect.step("copy");
        },
    });

    const menu = target.querySelector(".o_control_panel .d-inline-flex");
    await contains(menu.querySelector(".dropdown-toggle")).click();
    await contains(menu.querySelector(".o_documents_kanban_share_domain")).click();
    expect.verifySteps([]);
    await contains(".o_form_button_save").click();
    expect.verifySteps(["spreadsheet_shared", "copy"]);
});

test("thumbnail size in document side panel", async function () {
    const serverData = getTestServerData();
    serverData.models["documents.document"].records = [
        {
            name: "My spreadsheet",
            spreadsheet_data: "{}",
            is_favorited: false,
            folder_id: 1,
            handler: "spreadsheet",
        },
        {
            name: "",
            spreadsheet_data: "{}",
            is_favorited: true,
            folder_id: 1,
            handler: "spreadsheet",
        },
        {
            name: "",
            spreadsheet_data: "{}",
            is_favorited: false,
            folder_id: 1,
            handler: "spreadsheet",
        },
    ];
    await makeSpreadsheetMockEnv({ serverData });
    await mountView({
        type: "kanban",
        resModel: "documents.document",
        arch: basicDocumentKanbanArch,
        searchViewArch: getEnrichedSearchArch(),
    });

    await contains(".o_kanban_record:nth-of-type(1) .o_record_selector").click();
    expect(".o_documents_inspector_preview .o_document_preview").toHaveCount(1);
    expect(
        target.querySelector(".o_documents_inspector_preview .o_document_preview img").dataset.src
    ).toBe("/documents/image/1/268x130?field=thumbnail&unique=");
    await contains(".o_kanban_record:nth-of-type(2) .o_record_selector").click();
    expect(".o_documents_inspector_preview .o_document_preview").toHaveCount(2);
    let previews = target.querySelectorAll(
        ".o_documents_inspector_preview .o_document_preview img"
    );
    expect(previews[0].dataset.src).toBe("/documents/image/1/120x130?field=thumbnail&unique=");
    expect(previews[1].dataset.src).toBe("/documents/image/2/120x130?field=thumbnail&unique=");
    await contains(".o_kanban_record:nth-of-type(3) .o_record_selector").click();
    expect(".o_documents_inspector_preview .o_document_preview").toHaveCount(3);
    previews = target.querySelectorAll(".o_documents_inspector_preview .o_document_preview img");
    expect(previews[0].dataset.src).toBe("/documents/image/1/120x75?field=thumbnail&unique=");
    expect(previews[1].dataset.src).toBe("/documents/image/2/120x75?field=thumbnail&unique=");
    expect(previews[2].dataset.src).toBe("/documents/image/3/120x75?field=thumbnail&unique=");
});

test("open xlsx converts to o-spreadsheet, clone it and opens the spreadsheet", async function () {
    const spreadsheetId = 1;
    const spreadsheetCopyId = 99;
    const serverData = getTestServerData();
    serverData.models["documents.document"].records = [
        {
            id: spreadsheetId,
            name: "My excel file",
            mimetype: XLSX_MIME_TYPES[0],
            thumbnail_status: "present",
        },
    ];
    await makeSpreadsheetMockEnv({
        serverData,
        mockRPC: async (route, args) => {
            if (args.method === "clone_xlsx_into_spreadsheet") {
                expect.step("spreadsheet_cloned");
                expect(args.model).toBe("documents.document");
                expect(args.args).toEqual([spreadsheetId]);
                return spreadsheetCopyId;
            }
        },
    });
    await mountView({
        type: "kanban",
        resModel: "documents.document",
        arch: basicDocumentKanbanArch,
        searchViewArch: getEnrichedSearchArch(),
    });
    mockActionService((action) => {
        expect.step(action.tag);
        expect(action.params.spreadsheet_id).toEqual(spreadsheetCopyId);
    });
    await contains(".oe_kanban_previewer").click();

    // confirm conversion to o-spreadsheet
    await contains(".modal-content .btn.btn-primary").click();
    expect.verifySteps(["spreadsheet_cloned", "action_open_spreadsheet"]);
});

test("open WPS-marked xlsx converts to o-spreadsheet, clone it and opens the spreadsheet", async function () {
    const spreadsheetId = 1;
    const spreadsheetCopyId = 99;
    const serverData = getTestServerData();
    serverData.models["documents.document"].records = [
        {
            id: spreadsheetId,
            name: "My excel file",
            mimetype: XLSX_MIME_TYPES[1],
            thumbnail_status: "present",
        },
    ];
    await makeSpreadsheetMockEnv({
        serverData,
        mockRPC: async (route, args) => {
            if (args.method === "clone_xlsx_into_spreadsheet") {
                expect.step("spreadsheet_cloned");
                expect(args.model).toBe("documents.document");
                expect(args.args).toEqual([spreadsheetId]);
                return spreadsheetCopyId;
            }
        },
    });
    await mountView({
        type: "kanban",
        resModel: "documents.document",
        arch: basicDocumentKanbanArch,
        searchViewArch: getEnrichedSearchArch(),
    });
    mockActionService((action) => {
        expect.step(action.tag);
        expect(action.params.spreadsheet_id).toEqual(spreadsheetCopyId);
    });
    await contains(".oe_kanban_previewer").click();

    // confirm conversion to o-spreadsheet
    await contains(".modal-content .btn.btn-primary").click();
    expect.verifySteps(["spreadsheet_cloned", "action_open_spreadsheet"]);
});

test("download spreadsheet document while selecting requested document", async function () {
    const serverData = getTestServerData();
    serverData.models["documents.document"].records = [
        {
            name: "My spreadsheet",
            raw: "{}",
            is_favorited: false,
            folder_id: 1,
            handler: "spreadsheet",
        },
        {
            name: "Request",
            folder_id: 1,
            type: "empty",
        },
    ];
    await makeSpreadsheetMockEnv({ serverData });
    await mountView({
        type: "kanban",
        resModel: "documents.document",
        arch: basicDocumentKanbanArch,
        searchViewArch: getEnrichedSearchArch(),
    });

    await contains(".o_kanban_record:nth-of-type(1) .o_record_selector").click();
    await contains(".o_kanban_record:nth-of-type(2) .o_record_selector").click();
    await contains("button.o_inspector_download").click();
    expect(".o_notification").toHaveText(
        "Spreadsheets mass download not yet supported. Download spreadsheets individually instead."
    );
});

test("can open spreadsheet while multiple documents are selected along with it", async function () {
    const serverData = getTestServerData();
    serverData.models["documents.folder"].records = [
        { id: 1, display_name: "demo-workspace", has_write_access: true },
    ];
    serverData.models["documents.document"].records = [
        {
            name: "test-spreadsheet",
            raw: "{}",
            folder_id: 1,
            handler: "spreadsheet",
            thumbnail_status: "present",
        },
        {
            folder_id: 1,
            mimetype: "image/png",
            name: "test-image-1",
        },
        {
            folder_id: 1,
            mimetype: "image/png",
            name: "test-image-2",
        },
    ];
    await makeSpreadsheetMockEnv({ serverData });
    await mountView({
        type: "kanban",
        resModel: "documents.document",
        arch: basicDocumentKanbanArch,
        searchViewArch: getEnrichedSearchArch(),
    });

    mockActionService((action) => {
        expect.step(action.tag);
    });
    const fixture = getFixture();
    const records = fixture.querySelectorAll(".o_kanban_record");
    await contains(records[0].querySelector(".o_record_selector")).click();
    await contains(records[1].querySelector(".o_record_selector")).click();
    await contains(records[2].querySelector(".o_record_selector")).click();
    await contains(".oe_kanban_previewer").click();
    expect(".o_AttachmentViewer").toHaveCount(0);
    expect.verifySteps(["action_open_spreadsheet"]);
});
