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
            this.l10n_cl_sii_regional_office_selection =
                this.data.custom["l10n_cl_sii_regional_office_selection"];
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
        if (this.isChileanCompany() && orders) {
            // FIXME in master: when processing multiple orders, and at least one is an invoice of type Factura,
            //  then we will generate the pdf for all invoices linked to the orders,
            //  since the context is applicable for the whole RPC requests `create_from_ui` on all orders.
            const noOrderRequiresInvoicePrinting = orders.every(
                (order) => order.to_invoice && order.invoice_type === "boleta"
            );
            if (noOrderRequiresInvoicePrinting) {
                context = { ...context, generate_pdf: false };
            }
        }
        return context;
    },
    createNewOrder() {
        const order = super.createNewOrder(...arguments);
        if (!order.partner_id) {
            order.update({ partner_id: this.consumidor_final_anonimo_id });
        }
        return order;
    },
    getReceiptHeaderData(order) {
        const result = super.getReceiptHeaderData(...arguments);
        if (!this.isChileanCompany()) {
            return result;
        }
        result.company.cl_vat = this.company.vat;
        result.l10n_cl_sii_regional_office =
            this.l10n_cl_sii_regional_office_selection[
                order.company_id.l10n_cl_sii_regional_office
            ];
        result.l10n_latam_document_type = order.account_move.l10n_latam_document_type_id.name;
        result.l10n_latam_document_number = order.account_move.l10n_latam_document_number;

        return result;
    },
});
