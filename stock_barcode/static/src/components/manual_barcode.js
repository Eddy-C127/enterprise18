import { BarcodeDialog } from '@web/webclient/barcode/barcode_dialog';
import { onMounted, useRef, useState } from "@odoo/owl";


export class ManualBarcodeScanner extends BarcodeDialog {
    static template = "stock_barcode.ManualBarcodeScanner";

    setup() {
        super.setup();
        this.state = useState({
            ...this.state,
            barcode: false,
        });
        this.barcodeManual = useRef('manualBarcode');
        // Autofocus processing was blocked because a document already has a focused element.
        onMounted(() => {
            this.barcodeManual.el.focus();
        });
    }

    /**
     * Called when press Enter after filling barcode input manually.
     *
     * @private
     * @param {KeyboardEvent} ev
     */
    _onKeydown(ev) {
        if (ev.key === "Enter" && this.state.barcode) {
            this.onResult(this.state.barcode);
        }
    }
}
