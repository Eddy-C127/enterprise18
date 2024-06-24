/* @odoo-module */

export const stepUtils = {
    confirmAddingUnreservedProduct() {
        return [
            {
                trigger: '.modal-title:contains("Add extra product?")',
            },
            {
                trigger: ".btn-primary",
                in_modal: true,
                run: "click",
            },
        ];
    },
    validateBarcodeOperation(trigger = '.o_barcode_client_action') {
        return [
            {
                trigger,
                run: 'scan OBTVALI',
            },
            {
                trigger: '.o_notification_bar.bg-success',
            },
        ];
    },
    discardBarcodeForm() {
        return [
            {
                isActive: ["auto"],
                content: 'discard barcode form',
                trigger: '.o_discard',
                run: "click",
            },
            {
                isActive: ["auto"],
                content: 'wait to be back on the barcode lines',
                trigger: '.o_add_line',
            },
        ];
    },
};
