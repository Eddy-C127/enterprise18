/** @odoo-module */

import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { patch } from "@web/core/utils/patch";
import { floatIsZero } from "@web/core/utils/numbers";
import { ConfirmPopup } from "@point_of_sale/app/utils/confirm_popup/confirm_popup";
import { sprintf } from "@web/core/utils/strings";

patch(PaymentScreen.prototype, "pos_settle_due.PaymentScreen", {
    get partnerInfos() {
        const order = this.currentOrder;
        return this.pos.getPartnerCredit(order.get_partner());
    },
    get highlightPartnerBtn() {
        const order = this.currentOrder;
        const partner = order.get_partner();
        return (!this.partnerInfos.useLimit && partner) || (!this.partnerInfos.overDue && partner);
    },
    //@override
    async validateOrder(isForceValidate) {
        const _super = this._super;
        const order = this.currentOrder;
        const change = order.get_change();
        const paylaterPaymentMethod = this.pos.payment_methods.filter(
            (method) =>
                this.pos.config.payment_method_ids.includes(method.id) &&
                method.type == "pay_later"
        )[0];
        const existingPayLaterPayment = order
            .get_paymentlines()
            .find((payment) => payment.payment_method.type == "pay_later");
        if (
            order.get_orderlines().length === 0 &&
            !floatIsZero(change, this.pos.currency.decimal_places) &&
            paylaterPaymentMethod &&
            !existingPayLaterPayment
        ) {
            const partner = order.get_partner();
            if (partner) {
                const { confirmed } = await this.popup.add(ConfirmPopup, {
                    title: this.env._t("The order is empty"),
                    body: sprintf(
                        this.env._t("Do you want to deposit %s to %s?"),
                        this.env.utils.formatCurrency(change),
                        order.get_partner().name
                    ),
                    confirmText: this.env._t("Yes"),
                });
                if (confirmed) {
                    const paylaterPayment = order.add_paymentline(paylaterPaymentMethod);
                    paylaterPayment.set_amount(-change);
                    return _super(...arguments);
                }
            } else {
                const { confirmed } = await this.popup.add(ConfirmPopup, {
                    title: this.env._t("The order is empty"),
                    body: sprintf(
                        this.env._t(
                            "Do you want to deposit %s to a specific customer? If so, first select him/her."
                        ),
                        this.env.utils.formatCurrency(change)
                    ),
                    confirmText: this.env._t("Yes"),
                });
                if (confirmed) {
                    const { confirmed: confirmedPartner, payload: newPartner } =
                        await this.pos.showTempScreen("PartnerListScreen");
                    if (confirmedPartner) {
                        order.set_partner(newPartner);
                    }
                    const paylaterPayment = order.add_paymentline(paylaterPaymentMethod);
                    paylaterPayment.set_amount(-change);
                    return _super(...arguments);
                }
            }
        } else {
            return _super(...arguments);
        }
    },
    async _finalizeValidation() {
        await this._super(...arguments);
        const hasCustomerAccountAsPaymentMethod = this.currentOrder
            .get_paymentlines()
            .find((paymentline) => paymentline.payment_method.type === "pay_later");
        if (hasCustomerAccountAsPaymentMethod) {
            this.pos.refreshTotalDueOfPartner(this.currentOrder.get_partner());
        }
    },
});
