/** @odoo-module */

import { CashierName } from "@point_of_sale/app/navbar/cashier_name/cashier_name";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";

patch(CashierName.prototype, {
    setup() {
        super.setup(...arguments);
        this.printer = useService("printer");
    },
    async selectCashier() {
        if (this.pos.useBlackBoxBe() && this.pos.checkIfUserClocked()) {
            await this.pos.clock(this.printer, false);
        }
        this.pos.userSessionStatus = await this.pos.getUserSessionStatus();
        const result = await super.selectCashier();
        if (this.pos.useBlackBoxBe() && !this.pos.checkIfUserClocked()) {
            await this.pos.clock(this.printer, true);
        }
        this.pos.userSessionStatus = await this.pos.getUserSessionStatus();
        return result;
    },
    get userStatus() {
        return this.pos.userSessionStatus ? "Clocked in" : "Clocked out";
    },
});
