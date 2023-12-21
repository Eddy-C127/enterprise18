/* @odoo-module */

import { setupManager } from "@mail/../tests/helpers/webclient_setup";
import { patchUserWithCleanup } from "@web/../tests/helpers/mock_services";

import { patch } from "@web/core/utils/patch";
import { user } from "@web/core/user";
import { registry } from "@web/core/registry";

patch(setupManager, {
    setupServiceRegistries() {
        const services = registry.category("services");
        services.add("voip.ringtone", {
            start() {
                const ringtones = {
                    dial: {},
                    incoming: {},
                    ringback: {},
                };
                Object.values(ringtones).forEach((r) => Object.assign(r, { play: () => {} }));
                return {
                    ...ringtones,
                    stopPlaying() {},
                };
            },
        });
        const superHasGroup = user.hasGroup;
        patchUserWithCleanup({
            hasGroup: (group) => {
                return group === "base.group_user" || superHasGroup(group);
            }
        });
        return super.setupServiceRegistries(...arguments);
    },
});
