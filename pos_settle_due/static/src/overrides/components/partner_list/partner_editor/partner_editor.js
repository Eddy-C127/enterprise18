/** @odoo-module */

import { PartnerEditor } from "@point_of_sale/app/screens/partner_list/partner_editor/partner_editor";
import { patch } from "@web/core/utils/patch";

patch(PartnerEditor.prototype, {
    get partnerInfos() {
        return this.pos.getPartnerCredit(this.props.partner);
    },
    settleCustomerDue() {
        this.props.closePartnerList();
        this.props.close();
        this.pos.settleCustomerDue(this.props.partner);
    },
});
