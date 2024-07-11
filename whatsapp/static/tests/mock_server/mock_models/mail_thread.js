import { mailModels } from "@mail/../tests/mail_test_helpers";

export class MailThread extends mailModels.MailThread {
    /**
     * @override
     * @type {typeof mailModels.MailThread["prototype"]["_thread_to_store"]}
     */
    _thread_to_store(ids, store, request_list) {
        /** @type {import("mock_models").WhatsAppTemplate} */
        const WhatsAppTemplate = this.env["whatsapp.template"];
        super._thread_to_store(...arguments);
        store.add("mail.thread", {
            id: ids[0],
            model: this._name,
            canSendWhatsapp:
                WhatsAppTemplate.search_count([
                    ["model", "=", this._name],
                    ["status", "=", "approved"],
                ]) > 0,
        });
    }
}
