/** @odoo-module */
import { ClosePosPopup } from "@point_of_sale/app/navbar/closing_popup/closing_popup";
import { patch } from "@web/core/utils/patch";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
patch(ClosePosPopup.prototype, {
    async confirm() {
        if (this.pos.useBlackBoxBe()) {
            let status = await this.getUserSessionStatus(this.pos.pos_session.user_id[0]);
            if (status) {
                this.pos.env.services.dialog.add(AlertDialog, {
                    title: this.env._t("POS error"),
                    body: this.env._t("You need to clock out before closing the POS."),
                });
                return;
            }
        }
        return super.confirm();
    },
    async getUserSessionStatus(session, user) {
        return await this.env.services.orm.call("pos.session", "get_user_session_work_status", [
            [this.pos.pos_session.id],
            user
        ]);
    }
});
