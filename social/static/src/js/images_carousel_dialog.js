/** @odoo-module **/

import { Dialog } from "@web/core/dialog/dialog";
import { Component } from "@odoo/owl";

export class ImagesCarouselDialog extends Component {
    static components = { Dialog };
    static template = "social.ImagesCarouselDialog";
}
