import { SpreadsheetModels, defineSpreadsheetModels } from "@spreadsheet/../tests/helpers/data";
import { defineActions, fields, models, webModels } from "@web/../tests/web_test_helpers";
import { mockJoinSpreadsheetSession } from "@spreadsheet_edition/../tests/helpers/mock_server";
import { Domain } from "@web/core/domain";
import { getBasicPermissionPanelData, DocumentsModels } from "@documents/../tests/helpers/data";

const ACCESS_TOKEN_MY_SPREADSHEET = "accessTokenMyspreadsheet";
const {
    MailActivityType,
    MailAlias,
    MailAliasDomain,
    DocumentsTag,
    DocumentsDocument: Documents,
} = DocumentsModels;

export class DocumentsDocument extends Documents {
    spreadsheet_data = fields.Binary({ string: "Data" });
    handler = fields.Selection({
        string: "Handler",
        selection: [
            ["spreadsheet", "Spreadsheet"],
            ["frozen_spreadsheet", "Frozen Spreadsheet"],
            ["frozen_folder", "Frozen Folder"],
        ],
    });

    get_spreadsheets(domain = [], args) {
        let { offset, limit } = args;
        offset = offset || 0;

        const combinedDomain = Domain.and([domain, [["handler", "=", "spreadsheet"]]]).toList();
        const records = this.env["documents.document"]
            .search_read(combinedDomain)
            .map((spreadsheet) => ({
                display_name: spreadsheet.name,
                id: spreadsheet.id,
            }));
        const sliced = records.slice(offset, limit ? offset + limit : undefined);
        return { records: sliced, total: records.length };
    }

    join_spreadsheet_session(resId, accessToken) {
        const result = mockJoinSpreadsheetSession("documents.document").call(
            this,
            resId,
            accessToken
        );
        const record = this.env["documents.document"].search_read([["id", "=", resId]])[0];
        result.is_favorited = record.is_favorited;
        result.folder_id = record.folder_id[0];
        return result;
    }

    dispatch_spreadsheet_message() {
        return false;
    }

    action_open_new_spreadsheet(route, args) {
        const spreadsheetId = this.env["documents.document"].create({
            name: "Untitled spreadsheet",
            mimetype: "application/o-spreadsheet",
            spreadsheet_data: "{}",
            handler: "spreadsheet",
        });
        return {
            type: "ir.actions.client",
            tag: "action_open_spreadsheet",
            params: {
                spreadsheet_id: spreadsheetId,
                is_new_spreadsheet: true,
            },
        };
    }

    action_open_spreadsheet(args) {
        return {
            type: "ir.actions.client",
            tag: "action_open_spreadsheet",
            params: {
                spreadsheet_id: args[0],
            },
        };
    }

    _records = this._records.concat([
        {
            id: 2,
            name: "My spreadsheet",
            spreadsheet_data: "{}",
            is_favorited: false,
            folder_id: 1,
            handler: "spreadsheet",
            active: true,
            access_token: ACCESS_TOKEN_MY_SPREADSHEET,
        },
        {
            id: 3,
            name: "",
            spreadsheet_data: "{}",
            is_favorited: true,
            folder_id: 1,
            handler: "spreadsheet",
            active: true,
            access_token: "accessToken",
        },
    ]);
}

export class SpreadsheetTemplate extends models.Model {
    _name = "spreadsheet.template";

    name = fields.Char({ string: "Name", type: "char" });
    spreadsheet_data = fields.Binary({ string: "Spreadsheet Data" });
    thumbnail = fields.Binary({ string: "Thumbnail", type: "binary" });
    sequence = fields.Integer({ string: "Sequence", type: "integer" });

    fetch_template_data(route, args) {
        const [id] = args.args;
        const record = this.env["spreadsheet.template"].search_read([["id", "=", id]])[0];
        if (!record) {
            throw new Error(`Spreadsheet Template ${id} does not exist`);
        }
        return {
            data:
                typeof record.spreadsheet_data === "string"
                    ? JSON.parse(record.spreadsheet_data)
                    : record.spreadsheet_data,
            name: record.name,
            isReadonly: false,
        };
    }

    join_spreadsheet_session(resId, accessTokens) {
        return mockJoinSpreadsheetSession("spreadsheet.template").call(this, resId, accessTokens);
    }

    _records = [
        { id: 1, name: "Template 1", spreadsheet_data: "" },
        { id: 2, name: "Template 2", spreadsheet_data: "" },
    ];

    _views = {
        search: /* xml */ `<search><field name="name"/></search>`,
    };
}

export class IrModel extends SpreadsheetModels.IrModel {
    has_searchable_parent_relation() {
        return false;
    }

    get_available_models() {
        return this.env["ir.model"].search_read([], ["display_name", "model"]);
    }
}

export class IrUIMenu extends SpreadsheetModels.IrUIMenu {
    _views = {
        search: /* xml */ `<search/>`,
        list: /* xml */ `<list/>`,
        form: /* xml */ `<form/>`,
    };
}

export class ResCompany extends webModels.ResCompany {
    document_spreadsheet_folder_id = fields.Many2one({
        relation: "documents.document",
        default: 1,
    });
}

export function defineDocumentSpreadsheetModels() {
    const SpreadsheetDocumentModels = {
        MailActivityType,
        MailAlias,
        MailAliasDomain,
        DocumentsDocument,
        DocumentsTag,
        SpreadsheetTemplate,
        IrModel,
        IrUIMenu,
        ResCompany,
    };
    Object.assign(SpreadsheetModels, SpreadsheetDocumentModels);
    defineSpreadsheetModels();
}

export function defineDocumentSpreadsheetTestAction() {
    defineActions([
        {
            id: 1,
            name: "partner Action",
            res_model: "partner",
            xml_id: "spreadsheet.partner_action",
            views: [
                [false, "list"],
                [false, "pivot"],
                [false, "graph"],
                [false, "search"],
                [false, "form"],
            ],
        },
    ]);
}

export function getMySpreadsheetPermissionPanelData() {
    return getBasicPermissionPanelData({
        access_url: `https://localhost:8069/odoo/documents/${ACCESS_TOKEN_MY_SPREADSHEET}`,
        display_name: "My Spreadsheet",
        handler: "spreadsheet",
    });
}
