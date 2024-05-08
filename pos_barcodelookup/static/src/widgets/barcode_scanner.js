import { registry } from "@web/core/registry";
import { CharField, charField } from "@web/views/fields/char/char_field";
import * as BarcodeScanner from "@web/webclient/barcode/barcode_scanner";

export class BarcodeScannerWidget extends CharField {
    static template = "point_of_sale.barcodeformbarcode";
    setup() {
        super.setup();
    }
    async onBarcodeBtnClick() {
        const barcode = await BarcodeScanner.scanBarcode(this.env);
        if (barcode) {
            await this.props.record.update({
                barcode: barcode,
            });
        }
    }
}

export const barcodeScannerWidget = {
    ...charField,
    component: BarcodeScannerWidget,
};

registry.category("fields").add("productScanner", barcodeScannerWidget);
