import { mailModels } from "@mail/../tests/mail_test_helpers";

import { getKwArgs } from "@web/../tests/web_test_helpers";

export class MailMessage extends mailModels.MailMessage {
    /**
     * @override
     * @type {typeof mailModels.MailMessage["prototype"]["_to_store"]}
     */
    _to_store(ids, store, for_current_user, follower_by_message_partner) {
        const kwargs = getKwArgs(
            arguments,
            "ids",
            "store",
            "for_current_user",
            "follower_by_message_partner"
        );
        ids = kwargs.ids;
        store = kwargs.store;

        /** @type {import("mock_models").MailMessage} */
        const MailMessage = this.env["mail.message"];
        /** @type {import("mock_models").WhatsAppMessage} */
        const WhatsAppMessage = this.env["whatsapp.message"];

        super._to_store(...arguments);
        const messages = MailMessage._filter([["id", "in", ids]]);
        for (const message of messages) {
            const [whatsappMessage] = WhatsAppMessage.search_read([
                ["mail_message_id", "=", message.id],
            ]);
            if (whatsappMessage) {
                store.add("mail.message", { id: message.id, whatsappStatus: whatsappMessage.state });
            }
        }
    }
}
