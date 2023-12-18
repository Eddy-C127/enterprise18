/* @odoo-module */

import { Thread } from "@mail/core/common/thread_model";
import { patch } from "@web/core/utils/patch";
import { deserializeDateTime } from "@web/core/l10n/dates";
import { DEFAULT_AVATAR } from "@mail/core/common/persona_service";

import { toRaw } from "@odoo/owl";

patch(Thread.prototype, {
    _computeDiscussAppCategory() {
        return this.type === "whatsapp"
            ? this._store.discuss.whatsapp
            : super._computeDiscussAppCategory();
    },
    get importantCounter() {
        if (this.type === "whatsapp") {
            return this.message_unread_counter || this.message_needaction_counter;
        }
        return super.importantCounter;
    },
    get canLeave() {
        return this.type !== "whatsapp" && super.canLeave;
    },
    get canUnpin() {
        if (this.type === "whatsapp") {
            return this.importantCounter === 0;
        }
        return super.canUnpin;
    },

    get avatarUrl() {
        if (this.type !== "whatsapp") {
            return super.avatarUrl;
        }
        return DEFAULT_AVATAR;
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
