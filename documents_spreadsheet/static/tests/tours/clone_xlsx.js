/** @odoo-module**/

import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

registry.category("web_tour.tours").add("spreadsheet_clone_xlsx", {
    test: true,
    steps: () => [
        stepUtils.showAppsMenuItem(),
        {
            trigger: '.o_app[data-menu-xmlid="documents.menu_root"]',
            content: "Open document app",
            run: "click",
        },
        {
            trigger: '.o_search_panel_label_title:contains("Test folder")',
            content: "Open Test folder workspace",
            run: "click",
        },
        {
            trigger: '.o_inspector_value:contains("1")',
        },
        {
            trigger: '.o_search_panel_field header.active:contains("Test folder")',
            content: "Make sure we start with one card",
            run: "click",
        },
        {
            trigger: ".o_document_xlsx",
            content: "Open xlsx card",
            run: "click",
        },
        {
            trigger: "input#willArchive",
            content: "Uncheck sending to trash",
            run: "click",
        },
        {
            trigger: ".modal-dialog footer button.btn-primary",
            content: "Open with Odoo Spreadsheet",
            run: "click",
        },
        {
            trigger: ".o-spreadsheet-topbar",
            content: "Check that we are now in Spreadsheet",
        },
        {
            trigger: '[data-menu-xmlid="documents.dashboard"]',
            content: "Go back to Document App",
            run: "click",
        },
        {
            trigger: ".o_kanban_renderer .o_kanban_record:first:has('.o_document_spreadsheet')",
            content: "Check a spreadsheet document was created",
        },
        {
            trigger: ".o_document_xlsx",
            content: "Re-open the xlsx card",
            run: "click",
        },
        {
            trigger: ".modal-dialog footer button.btn-primary",
            content: "Open with Odoo Spreadsheet without unchecking the box",
            run: "click",
        },
        {
            trigger: ".o-spreadsheet-topbar",
            content: "Check that we are now in Spreadsheet",
        },
        {
            trigger: '[data-menu-xmlid="documents.dashboard"]',
            content: "Go back to Document App",
            run: "click",
        },
        {
            trigger: ".o_kanban_renderer:not(:has(.o_kanban_record .o_document_xlsx))",
            content: "Check that XLSX is no longer visible",
        },
        {
            trigger: '.o_search_panel_label_title:contains("Trash")',
            content: "Open Trash",
            run: "click",
        },
        {
            trigger: ".o_document_xlsx",
            content: "Select xlsx document",
            run: "click",
        },
        {
            trigger: ".modal-footer .btn-primary",
            content: "Restore xlsx document",
            run: "click",
        },
        {
            trigger: '.o_inspector_value:contains("3")',
        },
        {
            trigger: ".o_kanban_renderer",
            run: "click",
        },
    ],
});
