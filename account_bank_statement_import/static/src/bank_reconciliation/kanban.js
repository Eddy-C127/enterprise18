/** @odoo-module **/
import { registry } from "@web/core/registry";
import { AccountFileUploader, AccountDropZone } from "@account/components/bills_upload/bills_upload";
import { BankRecKanbanView, BankRecKanbanController, BankRecKanbanRenderer } from "@account_accountant/components/bank_reconciliation/kanban";
import { useState } from "@odoo/owl";

export class BankRecKanbanUploadController extends BankRecKanbanController {
    static components = {
        ...BankRecKanbanController.components,
        AccountFileUploader,
    }
}

export class BankRecUploadKanbanRenderer extends BankRecKanbanRenderer {
    static template = "account.BankRecKanbanUploadRenderer";
    static components = {
        ...BankRecKanbanRenderer.components,
        AccountDropZone,
    };
    setup() {
        super.setup();
        this.dropzoneState = useState({
            visible: false,
        });
    }
}

export const BankRecKanbanUploadView = {
    ...BankRecKanbanView,
    Controller: BankRecKanbanUploadController,
    Renderer: BankRecUploadKanbanRenderer,
    buttonTemplate: "account.BankRecKanbanButtons",
};

registry.category("views").add('bank_rec_widget_kanban', BankRecKanbanUploadView, { force: true });
