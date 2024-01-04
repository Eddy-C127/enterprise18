/** @odoo-module */

import { PartnerList } from "@point_of_sale/app/screens/partner_list/partner_list";
import { patch } from "@web/core/utils/patch";

patch(PartnerList.prototype, {
    createPartner() {
        super.createPartner(...arguments);

        if (this.pos.isChileanCompany() && this.props.partner) {
            this.props.partner.l10n_latam_identification_type_id = [
                this.pos["l10n_latam.identification.type"][0].id,
                this.pos["l10n_latam.identification.type"][0].name,
            ];
        }
    },
});
