/** @odoo-module **/

import { TourHelpers } from "@web_tour/tour_service/tour_helpers";
import { patch } from "@web/core/utils/patch";

patch(TourHelpers.prototype, {
    scan(barcode) {
        odoo.__WOWL_DEBUG__.root.env.services.barcode.bus.trigger("barcode_scanned", { barcode });
    },
});
