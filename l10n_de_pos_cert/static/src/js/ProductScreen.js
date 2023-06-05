/** @odoo-module */

import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { patch } from "@web/core/utils/patch";
import { TaxError } from "@l10n_de_pos_cert/js/errors";

patch(ProductScreen.prototype, "l10n_de_pos_cert.ProductScreen", {
    //@Override
    async _barcodeProductAction(code) {
        try {
            await this._super(...arguments);
        } catch (error) {
            if (this.pos.globalState.isCountryGermanyAndFiskaly() && error instanceof TaxError) {
                await this.pos._showTaxError();
            } else {
                throw error;
            }
        }
    },
});
