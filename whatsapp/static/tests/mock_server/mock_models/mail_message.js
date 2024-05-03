import { mailModels } from "@mail/../tests/mail_test_helpers";

export class MailMessage extends mailModels.MailMessage {
    /**
     * @override
     * @type {typeof mailModels.MailMessage["prototype"]["_message_format"]}
     */
    _message_format(ids) {
        /** @type {import("mock_models").WhatsAppMessage} */
        const WhatsAppMessage = this.env["whatsapp.message"];
        const formattedMessages = super._message_format(...arguments);
        for (const formattedMessage of formattedMessages) {
            const [whatsappMessage] = WhatsAppMessage.search_read([
                ["mail_message_id", "=", formattedMessage.id],
            ]);
            if (whatsappMessage) {
                formattedMessage.whatsappStatus = whatsappMessage.state;
            }
        }
        return formattedMessages;
    }
}
