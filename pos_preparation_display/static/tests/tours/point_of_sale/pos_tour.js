/** @odoo-module */

import * as ProductScreen from "@point_of_sale/../tests/tours/helpers/ProductScreenTourMethods";
import * as PaymentScreen from "@point_of_sale/../tests/tours/helpers/PaymentScreenTourMethods";
import * as ReceiptScreen from "@point_of_sale/../tests/tours/helpers/ReceiptScreenTourMethods";
import * as Dialog from "@point_of_sale/../tests/tours/helpers/DialogTourMethods";
import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add("PreparationDisplayTour", {
    test: true,
    steps: () =>
        [
            // First order should send these orderlines to preparation:
            // - Letter Tray x10
            Dialog.confirm("Open session"),

            ProductScreen.addOrderline("Letter Tray", "10"),
            ProductScreen.selectedOrderlineHas("Letter Tray", "10.0"),
            ProductScreen.addOrderline("Magnetic Board", "5"),
            ProductScreen.selectedOrderlineHas("Magnetic Board", "5.0"),
            ProductScreen.addOrderline("Monitor Stand", "1"),
            ProductScreen.selectedOrderlineHas("Monitor Stand", "1.0"),
            ProductScreen.clickPayButton(),

            PaymentScreen.clickPaymentMethod("Bank"),
            PaymentScreen.changeIs("0.0"),
            PaymentScreen.validateButtonIsHighlighted(true),
            PaymentScreen.clickValidate(),

            ReceiptScreen.clickNextOrder(),

            // Should not send anything to preparation
            ProductScreen.addOrderline("Magnetic Board", "5"),
            ProductScreen.selectedOrderlineHas("Magnetic Board", "5.0"),
            ProductScreen.addOrderline("Monitor Stand", "1"),
            ProductScreen.selectedOrderlineHas("Monitor Stand", "1.0"),
            ProductScreen.clickPayButton(),

            PaymentScreen.clickPaymentMethod("Bank"),
            PaymentScreen.changeIs("0.0"),
            PaymentScreen.validateButtonIsHighlighted(true),
            PaymentScreen.clickValidate(),

            ReceiptScreen.clickNextOrder(),
        ].flat(),
});

registry.category("web_tour.tours").add("PreparationDisplayPrinterTour", {
    test: true,
    steps: () =>
        [
            Dialog.confirm("Open session"),
            ProductScreen.addOrderline("Letter Tray"),
            ProductScreen.clickPayButton(),
            PaymentScreen.clickPaymentMethod("Bank"),
            PaymentScreen.clickValidate(),
            //This steps is making sure that we atleast tried to call the printer
            Dialog.is({ title: "Printing failed" }),
        ].flat(),
});

registry.category("web_tour.tours").add("PreparationDisplayTourConfigurableProduct", {
    test: true,
    steps: () =>
        [
            Dialog.confirm("Open session"),
            ProductScreen.clickDisplayedProduct("Configurable Chair"),
            Dialog.confirm(),
            ProductScreen.totalAmountIs("11.0"),
            ProductScreen.clickPayButton(),
            PaymentScreen.clickPaymentMethod("Bank"),
            PaymentScreen.changeIs("0.0"),
            PaymentScreen.validateButtonIsHighlighted(true),
            PaymentScreen.clickValidate(),
            ReceiptScreen.isShown(),
        ].flat(),
});
