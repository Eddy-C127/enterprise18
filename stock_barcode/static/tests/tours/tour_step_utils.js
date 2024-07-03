/* @odoo-module */

export const stepUtils = {
    confirmAddingUnreservedProduct() {
        return [
            {
                trigger: ".modal:not(.o_inactive_modal) .modal-title:contains(Add extra product?)",
                in_modal: false,
            },
            {
                trigger: ".modal:not(.o_inactive_modal) .btn-primary",
                in_modal: false,
                run: "click",
            },
            {
                trigger: "body:not(:has(.modal))",
            },
        ];
    },
    validateBarcodeOperation(trigger = ".o_barcode_client_action") {
        return [
            {
                trigger,
                run: "scan OBTVALI",
            },
            {
                trigger: ".o_notification_bar.bg-success",
            },
        ];
    },
    discardBarcodeForm() {
        return [
            {
                isActive: ["auto"],
                content: "discard barcode form",
                trigger: ".o_discard",
                run: "click",
            },
            {
                isActive: ["auto"],
                content: "wait to be back on the barcode lines",
                trigger: ".o_add_line",
            },
        ];
    },
};
