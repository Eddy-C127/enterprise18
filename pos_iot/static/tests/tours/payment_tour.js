/** @odoo-module */
/* global posmodel */

import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/tour_service/tour_utils";
import * as Dialog from "@point_of_sale/../tests/tours/utils/dialog_util";
import * as Order from "@point_of_sale/../tests/tours/utils/generic_components/order_widget_util";
import * as PaymentScreen from "@point_of_sale/../tests/tours/utils/payment_screen_util";
import { inLeftSide } from "@point_of_sale/../tests/tours/utils/common";

class TerminalProxy {
    action(data) {
        var self = this;
        switch (data.messageType) {
            case "Transaction":
                if (!this.transaction) {
                    this.transaction = true;
                    this.cid = data.cid;
                    setTimeout(function () {
                        self.listener({
                            Stage: "WaitingForCard",
                            cid: self.cid,
                        });
                    });
                    this.timer = setTimeout(function () {
                        self.listener({
                            Response: "Approved",
                            Reversal: true,
                            cid: self.cid,
                        });
                        self.transaction = false;
                    }, 1000);
                } else {
                    throw "Another transaction is still running";
                }
                break;
            case "Cancel":
                clearTimeout(this.timer);
                this.transaction = false;
                setTimeout(function () {
                    self.listener({
                        Error: "Canceled",
                        cid: self.cid,
                    });
                });
                break;
        }
        return Promise.resolve({
            result: true,
        });
    }
    addListener(callback) {
        this.listener = callback;
    }
    removeListener() {
        this.listener = false;
    }
}

registry.category("web_tour.tours").add("payment_terminals_tour", {
    test: true,
    steps: () => [
        stepUtils.showAppsMenuItem(),
        {
            content: "Select PoS app",
            trigger: '.o_app[data-menu-xmlid="point_of_sale.menu_point_root"]',
        },
        {
            content: "Start session",
            trigger: ".o_pos_kanban button.oe_kanban_action_button",
        },
        // PART 1: Pay exactly the price of order. Should automatically go to receipt screen.
        Dialog.confirm("Open session"),
        {
            content: "Waiting for loading to finish",
            trigger: ".pos .pos-content",
            run: function () {
                //Overrides the methods inside DeviceController to mock the IoT Box
                posmodel.models["pos.payment.method"].forEach(function (payment_method) {
                    if (payment_method.terminal_proxy) {
                        payment_method.terminal_proxy = new TerminalProxy();
                    }
                });
            },
        },
        {
            content: "Buy a Test Product",
            trigger: '.product-list .product-name:contains("Test Product")',
        },
        ...inLeftSide(Order.hasLine({ productName: "Test Product" })),
        {
            content: "Go to payment screen",
            trigger: ".button.pay-order-button",
        },
        {
            content: "There should be no payment line",
            trigger: ".paymentlines-empty",
            run: () => {},
        },
        {
            content: "Pay with payment terminal",
            trigger: '.paymentmethod:contains("Terminal")',
        },
        {
            content: "Cancel payment",
            trigger: ".button.send_payment_cancel",
        },
        ...PaymentScreen.clickPaymentlineDelButton("Terminal", "10.00"),
        {
            trigger: ".paymentlines-empty",
            isCheck: true,
        },
        ...PaymentScreen.enterPaymentLineAmount("Terminal", "5", true, { remainingIs: "5.00" }),
        {
            trigger: ".button.send_payment_request.highlight",
        },
        {
            trigger: ".electronic_status:contains('Successful')",
            isCheck: true,
        },
        ...PaymentScreen.clickPaymentMethod("Cash"),
        ...PaymentScreen.clickNumpad("5"),
        {
            content: "Check that the payment is confirmed",
            trigger: ".button.next.highlight",
        },
        {
            content: "Immediately at the receipt screen.",
            trigger: '.receipt-screen .button.next.highlight:contains("New Order")',
            run: function () {},
        },
    ],
});
