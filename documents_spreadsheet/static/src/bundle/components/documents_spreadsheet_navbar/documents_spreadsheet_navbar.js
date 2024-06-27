import { SpreadsheetNavbar } from "@spreadsheet_edition/bundle/components/spreadsheet_navbar/spreadsheet_navbar";

export class DocumentsSpreadsheetNavbar extends SpreadsheetNavbar {
    static template = "documents_spreadsheet.DocumentsSpreadsheetNavbar";
    static components = { ...SpreadsheetNavbar.components };
    static props = {
        ...SpreadsheetNavbar.props,
        isFavorited: {
            type: Boolean,
            optional: true,
        },
        onFavoriteToggled: {
            type: Function,
            optional: true,
        },
    };
}
