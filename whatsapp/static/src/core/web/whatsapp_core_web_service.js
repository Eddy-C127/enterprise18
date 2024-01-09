/* @odoo-module */

import { reactive } from "@odoo/owl";

import { registry } from "@web/core/registry";

export class WhatsappCoreWeb {
    constructor(env, services) {
        Object.assign(this, {
            busService: services.bus_service,
        });
        /** @type {import("@mail/core/common/messaging_service").Messaging} */
        this.messagingService = services["mail.messaging"];
        /** @type {import("@mail/core/common/store_service").Store} */
        this.store = services["mail.store"];
    }

    setup() {
        this.messagingService.isReady.then(() => {
            this.busService.subscribe(
                "discuss.channel/whatsapp_channel_valid_until_changed",
                (payload) => {
                    const { id, whatsapp_channel_valid_until } = payload;
                    const channel = this.store.Thread.insert({
                        model: "discuss.channel",
                        id: id,
                    });
                    if (channel) {
                        channel.update({ whatsapp_channel_valid_until });
                    }
                }
            );
        });
    }
}

export const whatsappCoreWeb = {
    dependencies: ["bus_service", "mail.messaging", "mail.store", "mail.thread"],
    start(env, services) {
        const whatsappCoreWeb = reactive(new WhatsappCoreWeb(env, services));
        whatsappCoreWeb.setup();
        return whatsappCoreWeb;
    },
};

registry.category("services").add("whatsapp.core.web", whatsappCoreWeb);
