/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { rpc } from "@web/core/network/rpc";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { registry } from "@web/core/registry";
import { user } from "@web/core/user";
import { useBus, useService } from "@web/core/utils/hooks";
import { serializeDate, today } from "@web/core/l10n/dates";
import { Component, onWillStart, useState } from "@odoo/owl";
import { ManualBarcodeScanner } from "./components/manual_barcode";
import { standardActionServiceProps } from "@web/webclient/actions/action_service";
import { url } from '@web/core/utils/urls';

export class MainMenu extends Component {
    static props = { ...standardActionServiceProps };
    static template = "stock_barcode.MainMenu";

    setup() {
        const displayDemoMessage = this.props.action.params.message_demo_barcodes;
        this.actionService = useService('action');
        this.dialogService = useService("dialog");
        this.home = useService("home_menu");
        this.notificationService = useService("notification");
        this.state = useState({ displayDemoMessage });
        this.barcodeService = useService('barcode');
        useBus(this.barcodeService.bus, "barcode_scanned", (ev) => this._onBarcodeScanned(ev.detail.barcode));
        const orm = useService('orm');

        onWillStart(async () => {
            this.locationsEnabled = await user.hasGroup('stock.group_stock_multi_locations');
            this.packagesEnabled = await user.hasGroup('stock.group_tracking_lot');
            this.trackingEnabled = await user.hasGroup('stock.group_production_lot');
            const args = [
                ["user_id", "=?", user.userId],
                ["location_id.usage", "in", ["internal", "transit"]],
                ["inventory_date", "<=", serializeDate(today())],
            ]
            this.quantCount = await orm.searchCount("stock.quant", args);
            const fileExtension = new Audio().canPlayType("audio/ogg") ? "ogg" : "mp3";
            this.sounds = {
                success: new Audio(url(`/stock_barcode/static/src/audio/success.${fileExtension}`)),
            };
            this.sounds.success.load();
        });
    }

    openManualBarcodeDialog() {
        this.dialogService.add(ManualBarcodeScanner, {
            onApply: (barcode) => this._onBarcodeScanned(barcode),
        });
    }

    removeDemoMessage() {
        this.state.displayDemoMessage = false;
        const params = {
            title: _t("Don't show this message again"),
            body: _t("Do you want to permanently remove this message ? " +
                    "It won't appear anymore, so make sure you don't need the barcodes sheet or you have a copy."),
            confirm: () => {
                rpc('/stock_barcode/rid_of_message_demo_barcodes');
                location.reload();
            },
            cancel: () => {},
            confirmLabel: _t("Remove it"),
            cancelLabel: _t("Leave it"),
        };
        this.dialogService.add(ConfirmationDialog, params);
    }

    async _onBarcodeScanned(barcode) {
        const res = await rpc('/stock_barcode/scan_from_main_menu', { barcode });
        if (res.action) {
            this.sounds["success"].play();
            return this.actionService.doAction(res.action);
        }
        this.notificationService.add(res.warning, { type: 'danger' });
    }
}

registry.category('actions').add('stock_barcode_main_menu', MainMenu);
