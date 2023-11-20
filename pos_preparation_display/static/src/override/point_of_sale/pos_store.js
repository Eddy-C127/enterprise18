/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";

patch(PosStore.prototype, {
    async setup() {
        await super.setup(...arguments);
        this["pos_preparation_display.display"] = [];
    },

    // @override - add preparation display categories to global order preparation categories
    get orderPreparationCategories() {
        let categoryIds = super.orderPreparationCategories;
        if (this.preparationDisplayCategoryIds) {
            categoryIds = new Set([...categoryIds, ...this.preparationDisplayCategoryIds]);
        }
        return categoryIds;
    },

    get preparationDisplayCategoryIds() {
        return new Set(
            this.models["pos_preparation_display.display"].flatMap((preparationDisplay) =>
                preparationDisplay.category_ids.flatMap((cat) => cat.id)
            )
        );
    },

    async sendOrderInPreparation(order, cancelled = false) {
        let result = true;

        if (this.models["pos_preparation_display.display"].length > 0) {
            result = await order.sendChanges(cancelled);
        }

        // We display this error popup only if the PoS is connected,
        // otherwise the user has already received a popup telling him
        // that this functionality will be limited.
        if (!result && this.data.network.offline) {
            this.dialog.add(AlertDialog, {
                title: _t("Send failed"),
                body: _t("Failed in sending the changes to preparation display"),
            });
        }

        return super.sendOrderInPreparation(order, cancelled);
    },
});
