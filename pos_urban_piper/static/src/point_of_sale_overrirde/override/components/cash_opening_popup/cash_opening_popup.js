import { patch } from "@web/core/utils/patch";
import { CashOpeningPopup } from "@point_of_sale/app/store/cash_opening_popup/cash_opening_popup";

patch(CashOpeningPopup.prototype, {
    /**
     * @override
     */
    async confirm() {
        await this.pos.updateStoreStatus(true);
        return super.confirm();
    },
});
