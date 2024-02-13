/** @odoo-module **/

import { patch } from '@web/core/utils/patch';
import { SaleOrderLineProductField } from '@sale/js/sale_product_field';

patch(SaleOrderLineProductField.prototype, {
    _getAdditionalDialogProps() {
        const props = super._getAdditionalDialogProps();
        const saleOrder = this.props.record.model.root;
        if (saleOrder.data.is_subscription) {
            props.subscriptionPlanId = saleOrder.data.plan_id[0];
        }
        return props;
    },
});
