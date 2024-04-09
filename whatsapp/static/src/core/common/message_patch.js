/** @odoo-module */

import { Message } from "@mail/core/common/message";
import { patch } from "@web/core/utils/patch";

patch(Message.prototype, {
    /** @override */
    get canReplyTo() {
        return super.canReplyTo && !this.message.thread?.composer?.threadExpired;
    },
    /**
     * @param {MouseEvent} ev
     */
    async onClick(ev) {
        const id = Number(ev.target.dataset.oeId);
        if (ev.target.closest(".o_whatsapp_channel_redirect")) {
            ev.preventDefault();
            let thread = await this.store.Thread.getOrFetch({ model: "discuss.channel", id });
            if (!thread?.hasSelfAsMember) {
                await this.env.services.orm.call("discuss.channel", "add_members", [[id]], {
                    partner_ids: [this.store.self.id],
                });
                thread = await this.store.Thread.getOrFetch({ model: "discuss.channel", id });
            }
            thread.open();
            return;
        }
        super.onClick(ev);
    },
});
