/* @odoo-module */

import { patch } from "@web/core/utils/patch";

import { DocumentsActivityModel } from "@documents/views/activity/documents_activity_model";
import { DocumentsKanbanModel } from "@documents/views/kanban/documents_kanban_model";
import { DocumentsListModel } from "@documents/views/list/documents_list_model";

const AccountIsViewablePatch = {
    /**
     * @override
     */
    isViewable() {
        if (this.data.mimetype.endsWith("/xml") && this.data.has_embedded_pdf) {
            return true;
        }
        return super.isViewable(...arguments);
    },
};

patch(DocumentsActivityModel.Record.prototype, AccountIsViewablePatch);
patch(DocumentsKanbanModel.Record.prototype, AccountIsViewablePatch);
patch(DocumentsListModel.Record.prototype, AccountIsViewablePatch);
