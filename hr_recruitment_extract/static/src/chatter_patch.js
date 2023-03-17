/* @odoo-module */

import { Chatter } from "@mail/web/chatter";
import { patch } from "@web/core/utils/patch";
import { useAttachmentUploader } from "@mail/attachments/attachment_uploader_hook";

patch(Chatter.prototype, "hr_recruitment_extract", {
    setup() {
        this._super();
        this.attachmentUploader = useAttachmentUploader(
            this.threadService.getThread(this.props.threadModel, this.props.threadId),
            {
                onFileUploaded: () => {
                    if (this.state.thread.model === "hr.applicant") {
                        this.reloadParentView();
                    }
                },
            }
        );
    },
});
