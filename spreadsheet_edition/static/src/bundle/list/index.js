/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import * as spreadsheet from "@odoo/o-spreadsheet";
import { initCallbackRegistry } from "@spreadsheet/o_spreadsheet/init_callbacks";

import "./autofill";
import "./operational_transform";

import { AllListsSidePanel } from "./side_panels/all_lists_side_panel";
import { ListDetailsSidePanel } from "./side_panels/list_details_side_panel";
import { ListAutofillPlugin } from "./plugins/list_autofill_plugin";

import { insertList } from "./list_init_callback";

const { featurePluginRegistry, sidePanelRegistry, cellMenuRegistry } = spreadsheet.registries;

featurePluginRegistry.add("odooListAutofillPlugin", ListAutofillPlugin);

sidePanelRegistry.add("ALL_LISTS_PANEL", {
    title: () => _t("List properties"),
    Body: AllListsSidePanel,
});
sidePanelRegistry.add("LIST_PROPERTIES_PANEL", {
    title: () => _t("List properties"),
    Body: ListDetailsSidePanel,
});

initCallbackRegistry.add("insertList", insertList);

cellMenuRegistry.add("listing_properties", {
    name: _t("See list properties"),
    sequence: 190,
    execute(env) {
        const position = env.model.getters.getActivePosition();
        const listId = env.model.getters.getListIdFromPosition(position);
        env.openSidePanel("LIST_PROPERTIES_PANEL", { listId });
    },
    isVisible: (env) => {
        const position = env.model.getters.getActivePosition();
        return env.model.getters.getListIdFromPosition(position) !== undefined;
    },
    icon: "o-spreadsheet-Icon.ODOO_LIST",
});
