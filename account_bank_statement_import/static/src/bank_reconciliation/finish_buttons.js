/** @odoo-module **/
import { patch } from "@web/core/utils/patch";
import { AccountFileUploader } from "@account/components/bills_upload/bills_upload";
import { BankRecFinishButtons } from "@account_accountant/components/bank_reconciliation/finish_buttons";

patch(BankRecFinishButtons, {
    components: {
        AccountFileUploader,
    }
})
