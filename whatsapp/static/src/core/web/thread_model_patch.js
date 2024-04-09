import { Thread } from "@mail/core/common/thread_model";
import { patch } from "@web/core/utils/patch";

patch(Thread.prototype, {
    async fetchData(requestList) {
        const result = await super.fetchData(requestList);
        this.canSendWhatsapp = result.canSendWhatsapp;
        return result;
    },
});
