import { patch } from "@web/core/utils/patch";
import { loadBundle } from "@web/core/assets";
import { DocumentsSearchModel } from "@documents/views/search/documents_search_model";

patch(DocumentsSearchModel.prototype, {
    async createSpreadsheetShare(spreadsheetIds) {
        await loadBundle("spreadsheet.o_spreadsheet");
        const { fetchSpreadsheetModel, freezeOdooData } = odoo.loader.modules.get(
            "@spreadsheet/helpers/model"
        );
        const spreadsheetShares = await Promise.all(
            spreadsheetIds.map(async (spreadsheetId) => {
                const model = await fetchSpreadsheetModel(
                    this.env,
                    "documents.document",
                    spreadsheetId
                );
                const data = await freezeOdooData(model);
                return {
                    spreadsheet_data: JSON.stringify(data),
                    excel_files: model.exportXLSX().files,
                    document_id: spreadsheetId,
                };
            })
        );
        return {
            spreadsheet_shares: spreadsheetShares,
        };
    },
});
