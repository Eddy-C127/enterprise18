/** @odoo-module **/

import { RunningTourActionHelper } from "@web_tour/tour_service/tour_utils";
import { patch } from "@web/core/utils/patch";

patch(RunningTourActionHelper.prototype, 'stock_barcode.RunningTourActionHelper', {
    _scan(element, barcode) {
        odoo.__DEBUG__.services['web.core'].bus.trigger('barcode_scanned', barcode, element);
    },
    scan(barcode, element) {
        this._scan(this._get_action_values(element), barcode);
    },
});
