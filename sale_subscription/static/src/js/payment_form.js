/** @odoo-module **/

import { ConfirmationDialog } from '@web/core/confirmation_dialog/confirmation_dialog';
import { _t } from '@web/core/l10n/translation';
import { renderToMarkup } from '@web/core/utils/render';

import paymentForm from '@payment/js/payment_form';

const savePaymentMethodCheckbox = document.querySelector(
    'input[name="o_payment_tokenize_checkbox"]'
);

paymentForm.include({
    events: Object.assign({}, paymentForm.prototype.events || {}, {
        'change input[name="o_payment_automate_payments_new_token"]':
            "_onChangeAutomatePaymentsCheckbox",
    }),

    /**
     * Replace the base token deletion confirmation dialog to prevent token deletion if a linked
     * subscription is active.
     *
     * @override method from @payment/js/payment_form
     * @private
     * @param {number} tokenId - The id of the token whose deletion was requested.
     * @param {object} linkedRecordsInfo - The data relative to the documents linked to the token.
     * @return {void}
     */
    _challengeTokenDeletion(tokenId, linkedRecordsInfo) {
        if (linkedRecordsInfo.every(linkedRecordInfo => !linkedRecordInfo['active_subscription'])) {
            this._super(...arguments);
            return;
        }

        const body = renderToMarkup('sale_subscription.deleteTokenDialog', { linkedRecordsInfo });
        this.call('dialog', 'add', ConfirmationDialog, {
            title: _t("Warning!"),
            body,
            cancel: () => {},
        });
    },

    /**
     * Override of payment method to update the paymentContext.transactionRoute depending
     * on the order we are paying.
     * For subscription invoices, when the customer wants to save the token on the order,
     * we update the transaction route on the fly.
     *
     * @private
     * @param {string} providerCode - The code of the selected payment option's provider.
     * @param {number} paymentOptionId - The id of the selected payment option.
     * @param {string} paymentMethodCode - The code of the selected payment method, if any.
     * @param {string} flow - The payment flow of the selected payment option.
     * @return {void}
     */
    async _initiatePaymentFlow(providerCode, paymentOptionId, paymentMethodCode, flow) {
        const autoPaymentCheckboxNewToken = document.querySelector(
            'input[name="o_payment_automate_payments_new_token"]'
        );
        const autoPaymentCheckboxSavedToken = document.querySelector(
            `input[name="o_payment_automate_payments_saved_token"][payment-option-id="${paymentOptionId}"]`
        );
        if (autoPaymentCheckboxNewToken?.checked || autoPaymentCheckboxSavedToken?.checked) {
            this.paymentContext.transactionRoute = this.paymentContext.txRouteSubscription;
        }
        return this._super(...arguments);
    },

    /**
     * Automatically check `Save my payment details` checkbox after clicking in the `Automate payments` option.
     *
     * @private
     * @return {void}
     */
    _onChangeAutomatePaymentsCheckbox: function (ev) {
        savePaymentMethodCheckbox.checked = ev.currentTarget.checked;
        savePaymentMethodCheckbox.disabled = ev.currentTarget.checked;
    },
});
