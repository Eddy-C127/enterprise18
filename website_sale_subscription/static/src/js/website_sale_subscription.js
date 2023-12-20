/** @odoo-module **/

import { WebsiteSale } from '@website_sale/js/website_sale';

WebsiteSale.include({

    /**
     * Assign the subscription plan to the rootProduct for subscription products.
     *
     * @override
     */
    _updateRootProduct($form, productId) {
        this._super(...arguments);
        Object.assign(this.rootProduct, {
            plan_id: parseInt($form.find('.product_price > select').val()),
        });
    },

    _handleAdd($form) {
        $form.find('.plan_select > option').each(function() {
            this.disabled = !this.selected;
        })
        return this._super(...arguments);
    }
});
