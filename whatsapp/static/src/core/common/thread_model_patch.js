/* @odoo-module */

import { Thread } from "@mail/core/common/thread_model";
import { patch } from "@web/core/utils/patch";
import { deserializeDateTime } from "@web/core/l10n/dates";

import { toRaw } from "@odoo/owl";

patch(Thread.prototype, {
    onUpdateType() {
        super.onUpdateType();
        this._store.discuss.whatsapp.threads = [
            [this.type === "whatsapp" ? "ADD" : "DELETE", this],
        ];
    },

    get imgUrl() {
        if (this.type !== "whatsapp") {
            return super.imgUrl;
        }
        return "/mail/static/src/img/smiley/avatar.jpg";
    },

    get isChatChannel() {
        return this.type === "whatsapp" || super.isChatChannel;
    },

    get whatsappChannelValidUntilDatetime() {
        if (!this.whatsapp_channel_valid_until) {
            return undefined;
        }
        return toRaw(deserializeDateTime(this.whatsapp_channel_valid_until));
    },
});
