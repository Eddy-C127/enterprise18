/** @odoo-module **/

import * as ProductScreenPos from "@point_of_sale/../tests/tours/utils/product_screen_util";
import * as ProductScreenSale from "@pos_sale/../tests/tours/utils/product_screen_util";
const ProductScreen = { ...ProductScreenPos, ...ProductScreenSale };
import * as PaymentScreen from "@point_of_sale/../tests/tours/utils/payment_screen_util";
import * as ReceiptScreen from "@point_of_sale/../tests/tours/utils/receipt_screen_util";
import * as Dialog from "@point_of_sale/../tests/tours/utils/dialog_util";
import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add("OrderLotsRentalTour", {
    test: true,
    steps: () =>
        [
            Dialog.confirm("Open session"),
            ProductScreen.clickControlButton("Quotation/Order"),
            ProductScreen.selectFirstOrder(),
            ProductScreen.clickLotIcon(),
            ProductScreen.enterLotNumber("123456789"),
            ProductScreen.clickPayButton(),
            PaymentScreen.clickPaymentMethod("Cash"),
            PaymentScreen.clickValidate(),
            ReceiptScreen.isShown(),
        ].flat(),
});
