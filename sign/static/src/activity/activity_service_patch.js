/** @odoo-module */

import { ActivityService } from "@mail/core/web/activity_service";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";

patch(ActivityService.prototype, {
    requestSignature(defaultActivityId = false, onClose = () => {}, documentReference = false) {
        const additionalContext = {
            sign_directly_without_mail: false,
            default_activity_id: defaultActivityId,
        };
        if (documentReference) {
            additionalContext.default_reference_doc = documentReference;
        }
        return this.env.services.action.doAction(
            {
                name: _t("Signature Request"),
                type: "ir.actions.act_window",
                view_mode: "form",
                views: [[false, "form"]],
                target: "new",
                res_model: "sign.send.request",
            },
            {
                additionalContext,
                onClose,
            }
        );
    },
});
