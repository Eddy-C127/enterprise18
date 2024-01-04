/** @odoo-module */

import { PosStore } from "@point_of_sale/app/store/pos_store";
import { patch } from "@web/core/utils/patch";

patch(PosStore.prototype, {
    // @Override
    async processServerData() {
        await super.processServerData();

        if (this.isChileanCompany()) {
            this.sii_taxpayer_types = this.data.custom["sii_taxpayer_types"];
            this.consumidor_final_anonimo_id = this.models["res.partner"].get(
                this.data.custom.consumidor_final_anonimo_id
            );
            this.config.consumidor_final_anonimo_id = this.models["res.partner"].get(
                this.data.custom.consumidor_final_anonimo_id
            );
            this["l10n_latam.identification.type"] =
                this.models["l10n_latam.identification.type"].getFirst();
        }
    },
    isChileanCompany() {
        return this.company.country_id?.code == "CL";
    },
    doNotAllowRefundAndSales() {
        return this.isChileanCompany() || super.doNotAllowRefundAndSales(...arguments);
    },
    getSyncAllOrdersContext(orders) {
        let context = super.getSyncAllOrdersContext(...arguments);
        if (this.isChileanCompany()) {
            // FIXME in master: when processing multiple orders, and at least one is an invoice of type Factura,
            //  then we will generate the pdf for all invoices linked to the orders,
            //  since the context is applicable for the whole RPC requests `create_from_ui` on all orders.
            const noOrderRequiresInvoicePrinting = orders.every(
                (order) => order.data.to_invoice && order.data.invoiceType === "boleta"
            );
            if (noOrderRequiresInvoicePrinting) {
                context = { ...context, generate_pdf: false };
            }
        }
        return context;
    },
});
