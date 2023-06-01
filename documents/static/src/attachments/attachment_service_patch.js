/* @odoo-module */

import { AttachmentService } from "@mail/attachments/attachment_service";
import { patch } from "@web/core/utils/patch";
import { assignDefined } from "@mail/utils/misc";

patch(AttachmentService.prototype, "documents", {

    update(attachment, data) {
        this._super(attachment, data);
        assignDefined(attachment, data, [
            "documentId",
        ]);
    },

});
