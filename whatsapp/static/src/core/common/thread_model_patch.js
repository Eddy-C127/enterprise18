/* @odoo-module */

import { Thread } from "@mail/core/common/thread_model";
import { patch } from "@web/core/utils/patch";
import { deserializeDateTime } from "@web/core/l10n/dates";

import { toRaw } from "@odoo/owl";

patch(Thread.prototype, {
    _computeDiscussAppCategory() {
        return this.channel_type === "whatsapp"
            ? this.store.discuss.whatsapp
            : super._computeDiscussAppCategory();
    },
    get importantCounter() {
        if (this.channel_type === "whatsapp") {
            return this.message_unread_counter || this.message_needaction_counter;
        }
        return super.importantCounter;
    },
    get canLeave() {
        return this.channel_type !== "whatsapp" && super.canLeave;
    },
    get canUnpin() {
        if (this.channel_type === "whatsapp") {
            return this.importantCounter === 0;
        }
        return super.canUnpin;
    },

    get avatarUrl() {
        if (this.channel_type !== "whatsapp") {
            return super.avatarUrl;
        }
        return this.store.DEFAULT_AVATAR;
    },

    get isChatChannel() {
        return this.channel_type === "whatsapp" || super.isChatChannel;
    },

    get whatsappChannelValidUntilDatetime() {
        if (!this.whatsapp_channel_valid_until) {
            return undefined;
        }
        return toRaw(deserializeDateTime(this.whatsapp_channel_valid_until));
    },
});
