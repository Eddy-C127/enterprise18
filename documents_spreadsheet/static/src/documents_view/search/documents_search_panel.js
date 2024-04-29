import { patch } from "@web/core/utils/patch";
import { DocumentsSearchPanel } from "@documents/views/search/documents_search_panel";

patch(DocumentsSearchPanel.prototype, {
    async prepareShareVals(resId) {
        const vals = await super.prepareShareVals(resId);
        const spreadsheetIds = await this.orm.search("documents.document", [
            ["handler", "=", "spreadsheet"],
            ["folder_id", "=", resId],
        ]);
        if (!spreadsheetIds.length) {
            return vals;
        }
        const spreadsheetShares = await this.env.searchModel.createSpreadsheetShare(spreadsheetIds);
        return {
            ...vals,
            ...spreadsheetShares,
        };
    },
});
