/** @odoo-module **/

import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

function deleteWorspaceSteps() {
    return [
        {
            trigger: '.o_search_panel_label_title:contains("Workspace1")',
            content: "Open workspace",
            run: "click",
        },
        {
            trigger: '.o_search_panel_field header.active:contains("Workspace1")',
            content: "Move to mouse on the workspace to display the edit widget",
            run: async function () {
                const elements = document.querySelectorAll(".o_search_panel_label_title");
                elements.forEach((element) => {
                    if (element.textContent.includes("Workspace1")) {
                        const event = new MouseEvent("mouseenter", {
                            view: window,
                            bubbles: true,
                            cancelable: true,
                        });
                        element.dispatchEvent(event);
                    }
                });
                await document
                    .querySelector("header.active .o_documents_search_panel_section_edit")
                    .click();
            },
        },
        {
            trigger: ".o_search_panel_value_edit_edit",
            content: "Edit workspace",
            run: "click",
        },
        {
            trigger: ".modal-footer .btn-outline-danger",
            content: "Delete workspace",
            run: "click",
        },
        {
            trigger: "button:has(span:contains('Move to trash'))",
            content: "Confirm",
            run: "click",
        },
    ];
}

function restoreDocumentSteps() {
    return [
        {
            trigger: '.o_search_panel_label_title:contains("Trash")',
            content: "Open trash",
            run: "click",
        },
        {
            trigger: '.o_search_panel_field header.active:contains("Trash")',
            content: "Check that we are in the trash",
        },
        {
            trigger: ".o_record_selector",
            content: "Select document",
            run: "click",
        },
        {
            trigger: ".o_inspector_button.o_archived",
            content: "Restore the document",
            run: "click",
        },
    ];
}

registry.category("web_tour.tours").add("document_delete_tour", {
    url: "/web",
    test: true,
    steps: () => [
        stepUtils.showAppsMenuItem(),
        {
            trigger: '.o_app[data-menu-xmlid="documents.menu_root"]',
            content: "Open document app",
            run: "click",
        },
        // 1) Archive a document and restore it in an active folder
        {
            trigger: '.o_search_panel_label_title:contains("Workspace1")',
            content: "Open workspace",
            run: "click",
        },
        {
            trigger: '.o_search_panel_field header.active:contains("Workspace1")',
            extra_trigger: '.o_inspector_value:contains("1")',
            content: "Make sure we start with one card",
            run: "click",
        },
        {
            trigger: ".o_record_selector",
            content: "Select document",
            run: "click",
        },
        {
            trigger: ".o_inspector_button.o_inspector_archive",
            content: "Move document to trash",
            run: "click",
        },
        {
            trigger: ".modal-footer .btn-primary",
            content: "Confirm deletion",
            run: "click",
        },
        {
            trigger: ".o_kanban_renderer:not(:has(.o_kanban_record:not(.o_kanban_ghost)))",
            content: "Check that the document is no longer visible",
        },
        ...restoreDocumentSteps(),
        // 2) Archive a folder (and this its documents) and restore the archived document
        ...deleteWorspaceSteps(),
        ...restoreDocumentSteps(),
        // 3) Archive a folder (and this its documents) and delete permanently the document
        ...deleteWorspaceSteps(),
        {
            trigger: '.o_search_panel_label_title:contains("Trash")',
            content: "Open trash",
            run: "click",
        },
        {
            trigger: '.o_search_panel_field header.active:contains("Trash")',
            content: "Check that we are in the trash",
        },
        {
            trigger: ".o_record_selector",
            content: "Select document",
            run: "click",
        },
        {
            trigger: ".o_inspector_button.o_inspector_delete",
            content: "Delete permanently the document",
            run: "click",
        },
        {
            trigger: ".modal-footer .btn-primary",
            content: "Confirm deletion",
            run: "click",
        },
    ],
});
