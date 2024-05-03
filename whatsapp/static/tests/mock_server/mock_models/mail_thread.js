import { mailModels } from "@mail/../tests/mail_test_helpers";

export class MailThread extends mailModels.MailThread {
    /**
     * @override
     * @type {typeof mailModels.MailThread["prototype"]["_get_mail_thread_data"]}
     */
    _get_mail_thread_data(id, request_list) {
        /** @type {import("mock_models").WhatsAppTemplate} */
        const WhatsAppTemplate = this.env["whatsapp.template"];
        const res = super._get_mail_thread_data(...arguments);
        res.canSendWhatsapp =
            WhatsAppTemplate.search_count([
                ["model", "=", this._name],
                ["status", "=", "approved"],
            ]) > 0;
        return res;
    }
}
