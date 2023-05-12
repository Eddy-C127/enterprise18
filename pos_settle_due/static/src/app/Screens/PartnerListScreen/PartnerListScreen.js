/** @odoo-module */

import { PartnerListScreen } from "@point_of_sale/js/Screens/PartnerListScreen/PartnerListScreen";
import { patch } from "@web/core/utils/patch";
import { SelectionPopup } from "@point_of_sale/js/Popups/SelectionPopup";
import { useService } from "@web/core/utils/hooks";

patch(PartnerListScreen.prototype, "pos_settle_due.PartnerListScreen", {
    setup() {
        this._super(...arguments);
        this.popup = useService("popup");
    },
    get isBalanceDisplayed() {
        return true;
    },
    get partnerLink() {
        return `/web#model=res.partner&id=${this.state.editModeProps.partner.id}`;
    },
    get partnerInfos() {
        return this.pos.getPartnerCredit(this.props.partner);
    },
    async settleCustomerDue() {
        const { globalState } = this.pos;
        const updatedDue = await globalState.refreshTotalDueOfPartner(
            this.state.editModeProps.partner
        );
        const totalDue = updatedDue
            ? updatedDue[0].total_due
            : this.state.editModeProps.partner.total_due;
        const paymentMethods = globalState.payment_methods.filter(
            (method) =>
                globalState.config.payment_method_ids.includes(method.id) &&
                method.type != "pay_later"
        );
        const selectionList = paymentMethods.map((paymentMethod) => ({
            id: paymentMethod.id,
            label: paymentMethod.name,
            item: paymentMethod,
        }));
        const { confirmed, payload: selectedPaymentMethod } = await this.popup.add(SelectionPopup, {
            title: this.env._t("Select the payment method to settle the due"),
            list: selectionList,
        });
        if (!confirmed) {
            return;
        }
        this.state.selectedPartner = this.state.editModeProps.partner;
        this.confirm(); // make sure the PartnerListScreen resolves and properly closed.

        // Reuse an empty order that has no partner or has partner equal to the selected partner.
        let newOrder;
        const emptyOrder = globalState.orders.find(
            (order) =>
                order.orderlines.length === 0 &&
                order.paymentlines.length === 0 &&
                (!order.partner || order.partner.id === this.state.selectedPartner.id)
        );
        if (emptyOrder) {
            newOrder = emptyOrder;
            // Set the empty order as the current order.
            globalState.set_order(newOrder);
        } else {
            newOrder = globalState.add_new_order();
        }
        const payment = newOrder.add_paymentline(selectedPaymentMethod);
        payment.set_amount(totalDue);
        newOrder.set_partner(this.state.selectedPartner);
        this.pos.showScreen("PaymentScreen");
    },
});
