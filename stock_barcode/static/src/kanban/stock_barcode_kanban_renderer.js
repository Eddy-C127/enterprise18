/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { KanbanRenderer } from '@web/views/kanban/kanban_renderer';
import { user } from "@web/core/user";
import { useService } from '@web/core/utils/hooks';
import * as BarcodeScanner from '@web/webclient/barcode/barcode_scanner';
import { onWillStart } from "@odoo/owl";
import { ManualBarcodeScanner } from "../components/manual_barcode";

export class StockBarcodeKanbanRenderer extends KanbanRenderer {
    static template = "stock_barcode.KanbanRenderer";
    setup() {
        super.setup(...arguments);
        this.barcodeService = useService('barcode');
        this.dialogService = useService("dialog");
        this.display_protip = this.props.list.resModel === 'stock.picking';
        onWillStart(async () => {
            this.packageEnabled = await user.hasGroup('stock.group_tracking_lot');
            this.isMobileScanner = BarcodeScanner.isBarcodeScannerSupported();
        });
    }

    openManualBarcodeDialog() {
        this.dialogService.add(ManualBarcodeScanner, {
            openMobileScanner: async () => {
                await this.openMobileScanner();
            },
            onApply: (barcode) => {
                this._onBarcodeScanned(barcode);
                return barcode;
            }
        });
    }

    async openMobileScanner() {
        const barcode = await BarcodeScanner.scanBarcode(this.env);
        if (barcode) {
            this._onBarcodeScanned(barcode);
        } else {
            this.env.services.notification.add(
                _t("Please, Scan again!"),
                {type: 'warning'}
            );
        }
    }

    _onBarcodeScanned(barcode) {
        this.barcodeService.bus.trigger("barcode_scanned", { barcode });
        if ("vibrate" in window.navigator) {
            window.navigator.vibrate(100);
        }
    }
}
