/** @odoo-module */

import { registry } from "@web/core/registry";
import { ListRenderer } from "@web/views/list/list_renderer";
import { AccountFileUploader, AccountDropZone } from "@account/components/bills_upload/bills_upload";
import { bankRecListView, BankRecListController } from "@account_accountant/components/bank_reconciliation/list";
import { useState } from "@odoo/owl";

export class BankRecListUploadController extends BankRecListController {
    static components = {
        ...BankRecListController.components,
        AccountFileUploader,
    }
}

export class BankRecListUploadRenderer extends ListRenderer {
    static template = "account.BankRecListUploadRenderer";
    static components = {
        ...ListRenderer.components,
        AccountDropZone,
    }

    setup() {
        super.setup();
        this.dropzoneState = useState({ visible: false });
    }
}

export const bankRecListUploadView = {
    ...bankRecListView,
    Controller: BankRecListUploadController,
    Renderer: BankRecListUploadRenderer,
    buttonTemplate: "account.BankRecListUploadButtons",
}

registry.category("views").add("bank_rec_list", bankRecListUploadView, { force: true });
