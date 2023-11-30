/** @odoo-module **/

import { KanbanController } from "@web/views/kanban/kanban_controller";

import { preSuperSetup, useDocumentView } from "@documents/views/hooks";
import { onMounted, useState } from "@odoo/owl";
import { browser } from "@web/core/browser/browser";
import { parseSearchQuery } from "@web/core/browser/router";

export class DocumentsKanbanController extends KanbanController {
    static template = "documents.DocumentsKanbanView";
    setup() {
        preSuperSetup();
        super.setup(...arguments);
        const properties = useDocumentView(this.documentsViewHelpers());
        Object.assign(this, properties);

        this.documentStates = useState({
            inspectedDocuments: [],
            previewStore: {},
        });

        /**
         * Open document preview when the page is accessed from an activity link
         * @_get_access_action
         */
        onMounted(() => {
            const urlSearch = parseSearchQuery(browser.location.search);
            if (urlSearch.preview_id) {
                const document = this.model.root.records.find(
                    (record) => record.data.id === urlSearch.preview_id
                );
                if (document) {
                    document.selected = true;
                    document.onClickPreview(new Event("click"));
                }
            }
        });
    }

    get modelParams() {
        const modelParams = super.modelParams;
        modelParams.multiEdit = true;
        return modelParams;
    }

    /**
     * Override this to add view options.
     */
    documentsViewHelpers() {
        return {
            getSelectedDocumentsElements: () =>
                this.root.el.querySelectorAll(".o_kanban_record.o_record_selected"),
            setInspectedDocuments: (inspectedDocuments) => {
                this.documentStates.inspectedDocuments = inspectedDocuments;
            },
            setPreviewStore: (previewStore) => {
                this.documentStates.previewStore = previewStore;
            },
        };
    }
}
