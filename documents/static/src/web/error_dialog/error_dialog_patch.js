import { CopyButton } from "@web/core/copy_button/copy_button";
import { ErrorDialog } from "@web/core/errors/error_dialogs";
import { _t } from "@web/core/l10n/translation";
import { x2ManyCommands } from "@web/core/orm_service";
import { user } from "@web/core/user";
import { useBus, useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";

patch(ErrorDialog.components, {
    CopyButton,
});

patch(ErrorDialog.prototype, {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.fileUpload = useService("file_upload");
        this.dialogService = useService("dialog");
        this.notification = useService("notification");
        this.state.shareUrl = null;
        this.state.shared = false;
        this.copiedText = _t("Copied");
        this.isAdmin = user.isAdmin;
        useBus(this.fileUpload.bus, "FILE_UPLOAD_LOADED", async (ev) => {
            const response = JSON.parse(ev.detail.upload.xhr.response);
            const record = {
                document_ids: [x2ManyCommands.set([response.id])],
                domain: [],
                folder_id: response.folder_id,
                tag_ids: [x2ManyCommands.set([])],
                type: "ids",
            };
            const res = await this.orm.webSave("documents.share", [], record, {
                specification: { full_url: {} },
            });
            navigator.clipboard.writeText(res[0].full_url);
            this.state.shareUrl = res[0].full_url;
            this.notification.add(_t("The share URL has been copied to your clipboard."), {
                type: "success",
            });
        });
    },
    shareTraceback() {
        if (!this.state.shared) {
            this.state.shared = true;
            const file = new File(
                [
                    `${this.props.name}\n\n${this.props.message}\n\n${this.contextDetails}\n\n${
                        this.traceback || this.props.traceback
                    }`,
                ],
                `${this.constructor.title} - ${luxon.DateTime.local().toFormat(
                    "yyyy-MM-dd HH:mm:ss"
                )}.txt`,
                { type: "text/plain" }
            );
            this.fileUpload.upload("/documents/upload_traceback", [file]);
        }
    },
});
