/** @odoo-module **/

import { Component, useState, onWillStart } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { useService } from "@web/core/utils/hooks";

export class ProductImageDialog extends Component {
    static components = { Dialog };
    static props = {
        record: Object,
        close: Function,
    };
    static template = "stock_barcode.ProductImageDialog";

    setup() {
        this.orm = useService("orm");
        this.state = useState({ source: `data:image/png;base64,${this.props.record.image_128}` });
        this.title = this.props.record.display_name;
        onWillStart(() => {
            new Promise(async (resolve) => {
                const result = this.orm.read("product.product", [this.props.record.id], ["image_1024"]);
                resolve(result);
            }).then(data => {
                this.state.source = `data:image/png;base64,${data[0].image_1024}`;
            })
        });
    }
}
