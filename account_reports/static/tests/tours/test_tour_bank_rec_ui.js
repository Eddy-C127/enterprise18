import { patch } from "@web/core/utils/patch";
import { accountTourSteps } from "@account/js/tours/account";

patch(accountTourSteps, {
    bankRecUiReportSteps() {
        return [
            {
                content: "balance is 2100",
                extra_trigger: ".o_bank_rec_selected_st_line:contains('line1')",
                trigger: ".btn-link:contains('$ 2,100.00')",
                run: "click",
            },
            {
                content: "Breadcrumb back to Bank Reconciliation from the report",
                extra_trigger: "span:contains('General Ledger')",
                trigger: ".breadcrumb-item a:contains('Bank Reconciliation')",
                allowInvisible: true,
                run: "click",
            },
        ]
    },
});
