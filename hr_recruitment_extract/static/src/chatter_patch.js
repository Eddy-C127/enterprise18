/* @odoo-module */

import { Chatter } from "@mail/chatter/web_portal/chatter";
import { patch } from "@web/core/utils/patch";
import { useAttachmentUploader } from "@mail/core/common/attachment_uploader_hook";

patch(Chatter.prototype, {
    setup() {
        super.setup();
        this.attachmentUploader = useAttachmentUploader(
            this.store.Thread.insert({ model: this.props.threadModel, id: this.props.threadId }),
            {
                onFileUploaded: () => {
                    if (this.state.thread?.model === "hr.applicant") {
                        this.reloadParentView();
                    }
                },
            }
        );
    },
});
