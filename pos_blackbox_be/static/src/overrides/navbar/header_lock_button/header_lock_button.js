/** @odoo-module */

import { HeaderLockButton } from "@pos_hr/app/header_lock_button/header_lock_button";
import { patch } from "@web/core/utils/patch";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
patch(HeaderLockButton.prototype, {
    async showLoginScreen() {
         if (this.pos.useBlackBoxBe() && this.pos.checkIfUserClocked()) {
            this.pos.env.services.dialog.add(AlertDialog, {
                title: this.env._t("Fiscal Data Module Restriction"),
                body: this.env._t("You must clock out in order to change the current employee."),
            });
            return;
         }
         super.showLoginScreen();
    }
});
