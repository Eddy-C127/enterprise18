import { patch } from "@web/core/utils/patch";
import { ReceiptScreen } from "@point_of_sale/app/screens/receipt_screen/receipt_screen";
import { _t } from "@web/core/l10n/translation";

patch(ReceiptScreen.prototype, {
    setup() {
        super.setup(...arguments);
        if (this.pos.config.whatsapp_enabled) {
            this.state.input ||= this.currentOrder.get_partner()?.mobile || "";
        }
    },
    isValidPhoneNumber(x) {
        return x && /^\+?[()\d\s-.]{8,18}$/.test(x);
    },
    actionSendReceipt() {
        if (this.state.mode === "whatsapp" && this.isValidPhoneNumber(this.state.input)) {
            this.sendReceipt.call({ action: "action_sent_receipt_on_whatsapp", name: "WhatsApp" });
        } else if (this.state.mode === "whatsapp") {
            this.notification.add(_t("Please enter a valid phone number"), {
                type: "danger",
            });
        } else {
            super.actionSendReceipt(...arguments);
        }
    },
    changeMode(mode) {
        if (mode !== "whatsapp" || !this.pos.config.whatsapp_enabled) {
            return super.changeMode(mode);
        }

        this.state.mode = mode;
        this.state.input = this.currentOrder.partner_id?.phone || this.state.input || "";
    },
    get isValidInput() {
        return this.state.mode === "whatsapp"
            ? this.isValidPhoneNumber(this.state.input)
            : super.isValidInput;
    },
});
