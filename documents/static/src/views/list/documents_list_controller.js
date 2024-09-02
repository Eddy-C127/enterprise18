/** @odoo-module **/

import { ListController } from "@web/views/list/list_controller";
import { _t } from "@web/core/l10n/translation";
import { preSuperSetup, useDocumentView } from "@documents/views/hooks";
import { useRef, useState } from "@odoo/owl";

export class DocumentsListController extends ListController {
    static template = "documents.DocumentsListController";
    setup() {
        preSuperSetup();
        super.setup(...arguments);
        this.uploadFileInputRef = useRef("uploadFileInput");
        const properties = useDocumentView(this.documentsViewHelpers());
        Object.assign(this, properties);

        this.documentStates = useState({
            inspectedDocuments: [],
            previewStore: {},
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
                this.root.el.querySelectorAll(
                    ".o_data_row.o_data_row_selected .o_list_record_selector"
                ),
            setInspectedDocuments: (inspectedDocuments) => {
                this.documentStates.inspectedDocuments = inspectedDocuments;
            },
            setPreviewStore: (previewStore) => {
                this.documentStates.previewStore = previewStore;
            },
        };
    }

    getStaticActionMenuItems() {
        const isM2MGrouped = this.model.root.isM2MGrouped;
        return {
            export: {
                isAvailable: () => this.isExportEnable,
                sequence: 10,
                description: _t("Export"),
                callback: () => this.onExportData(),
            },
            delete: {
                isAvailable: () => {
                    return this.activeActions.delete
                        && !isM2MGrouped
                        && this.model.root.records.length;
                },
                sequence: 40,
                description: _t("Delete"),
                callback: () => {
                    return this.model.root.records[0].isActive
                        ? this.onArchiveSelectedRecords()
                        : this.onDeleteSelectedRecords();
                },
            },
        };
    }

    onDeleteSelectedRecords() {
        const root = this.model.root;
        const callback = async () => {
            await root.deleteRecords(root.records.filter((record) => record.selected));
            await this.model.notify();
        };
        root.records[0].openDeleteConfirmationDialog(root, callback, true);
    }

    onArchiveSelectedRecords() {
        const root = this.model.root;
        const callback = async () => {
            await this.toggleArchiveState(true);
        };
        root.records[0].openDeleteConfirmationDialog(root, callback, false);
    }
}
