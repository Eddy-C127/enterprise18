/** @odoo-module **/

import { registry } from "@web/core/registry";

const servicesToRemove = ["studio", "studio_legacy"];

const servicesRegistry = registry.category("services");

/**
 * Remove unused features for which the user has not enough rights.
 */
export function removeRestricted() {
    for (const service of servicesToRemove) {
        if (servicesRegistry.contains(service)) {
            servicesRegistry.remove(service);
        }
    }
}
