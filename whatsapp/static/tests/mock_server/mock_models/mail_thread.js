import { mailModels } from "@mail/../tests/mail_test_helpers";

export class MailThread extends mailModels.MailThread {
    /**
     * @override
     * @type {typeof mailModels.MailThread["prototype"]["_to_store"]}
     */
    _to_store(id, store, request_list) {
        /** @type {import("mock_models").WhatsAppTemplate} */
        const WhatsAppTemplate = this.env["whatsapp.template"];
        super._to_store(...arguments);
        store["Thread"][0].canSendWhatsapp =
            WhatsAppTemplate.search_count([
                ["model", "=", this._name],
                ["status", "=", "approved"],
            ]) > 0;
    }
}
