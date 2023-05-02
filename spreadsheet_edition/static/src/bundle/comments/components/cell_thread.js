import { Component, useState, onWillUpdateProps, useChildSubEnv } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { Thread } from "@mail/core/common/thread";
import { Composer } from "@mail/core/common/composer";
import { SpreadsheetCommentComposer } from "./spreadsheet_comment_composer";

export class CellThread extends Component {
    static template = "spreadsheet_edition.CellThread";
    static components = { Thread, Composer, SpreadsheetCommentComposer };

    static props = {
        threadId: Number,
        edit: Boolean,
        autofocus: { type: Number, optional: true },
    };
    static defaultProps = { autofocus: 0 };
    static threadModel = "spreadsheet.cell.thread";

    setup() {
        useChildSubEnv({
            inChatWindow: true,
            chatter: {},
        });
        /** @type {import("@mail/core/thread_service").ThreadService} */
        this.threadService = useService("mail.thread");
        this.state = useState({
            /** @type {import("@mail/core/thread_model").Thread} */
            thread: undefined,
        });
        this.loadThread(this.props.threadId);

        onWillUpdateProps((nextProps) => {
            if (this.props.threadId !== nextProps.threadId) {
                this.loadThread(nextProps.threadId);
            }
        });
    }

    loadThread(threadId) {
        this.state.thread = this.threadService.store.Thread.insert({
            model: CellThread.threadModel,
            id: threadId,
        });
        this.threadService.fetchNewMessages(this.state.thread);
    }

    get placeholder() {
        return _t("Add a comment...");
    }
}
