/** @odoo-module */

import { PosStore } from "@point_of_sale/app/store/pos_store";
import { patch } from "@web/core/utils/patch";

patch(PosStore.prototype, {
    //@override
    async processServerData() {
        await super.processServerData();
        if (this.company.country_id?.code === "MX") {
            this.l10n_mx_edi_fiscal_regime = this.data.custom["l10n_mx_edi_fiscal_regime"];
            this.l10n_mx_country_id = this.data.custom["l10n_mx_country_id"];
            this.l10n_mx_edi_usage = this.data.custom["l10n_mx_edi_usage"];
        }
    },
});
