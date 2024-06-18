import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { accountTourSteps } from "@account/js/tours/account";

patch(accountTourSteps, {
    onboarding() {
        return [
            {
                trigger: "a[data-method=action_open_step_fiscal_year]",
                extra_trigger: ".o_widget_account_onboarding .fa-circle",
                content: _t("Set Periods"),
                run: "click",
            },
            {
                trigger: "button[name=action_save_onboarding_fiscal_year]",
                content: _t("Save Fiscal Year end"),
                run: "click",
            },
        ];
    },
    newInvoice() {
        return [
            {
                trigger: "button[name=action_create_new]",
                extra_trigger: ".o_widget_account_onboarding .fa-check-circle",
                content: _t("Now, we'll create your first invoice (accountant)"),
                run: "click",
            },
        ];
    },
});
