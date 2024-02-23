/** @odoo-module **/
import { OrderlineNoteButton } from "@point_of_sale/app/screens/product_screen/control_buttons/customer_note_button/customer_note_button";
import { patch } from "@web/core/utils/patch";

patch(OrderlineNoteButton.prototype, {
    // Override
    async onClick() {
        const { confirmed, inputNote, oldNote } = await super.onClick();
        const selectedOrderline = this.pos.get_order().get_selected_orderline();
        const productId = selectedOrderline.product.id;
        const order = selectedOrderline.order;

        if (confirmed) {
            if (!order.noteHistory) {
                order.noteHistory = {};
            }

            if (!order.noteHistory[productId]) {
                order.noteHistory[productId] = [];
            }

            let added = false;
            for (const note of order.noteHistory[productId]) {
                if (note.lineId === selectedOrderline.id) {
                    note.new = inputNote;
                    added = true;
                }
            }

            if (!added) {
                order.noteHistory[productId].push({
                    old: oldNote,
                    new: inputNote || "",
                    lineId: selectedOrderline.id,
                });
            }
        }
    },
});
