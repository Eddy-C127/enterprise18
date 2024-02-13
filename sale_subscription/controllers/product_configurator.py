# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.http import request

from odoo.addons.sale.controllers.product_configurator import SaleProductConfiguratorController


class SaleSubscriptionProductConfiguratorController(SaleProductConfiguratorController):

    def _get_basic_product_information(
        self,
        product_or_template,
        pricelist,
        combination,
        currency=None,
        date=None,
        subscription_plan_id=None,
        **kwargs,
    ):
        """ Override of `sale` to append subscription data.

        :param recordset product_or_template: The product for which to seek information, as a
                                              `product.product` or `product.template` record.
        :param recordset pricelist: The pricelist to use, as a `product.pricelist` record.
        :param recordset combination: The combination of the product, as a
                                      `product.template.attribute.value` recordset.
        :param recordset|None currency: The currency of the transaction, as a `res.currency` record.
        :param datetime|None date: The date of the `sale.order`, to compute the price at the right
                                   rate.
        :param int subscription_plan_id|None: The subscription plan of the product, as a
                                              `sale.subscription.plan` id.
        :param dict kwargs: Locally unused data passed to `super`.
        :rtype: dict
        :return: A dict with the following structure:
            {
                ...  # fields from `super`.
                'price': float,
                'price_info': str,
            }
        """
        basic_product_information = super()._get_basic_product_information(
            product_or_template,
            pricelist,
            combination,
            currency=currency,
            date=date,
            subscription_plan_id=subscription_plan_id,
            **kwargs,
        )

        if product_or_template.recurring_invoice:
            subscription_plan = request.env['sale.subscription.plan'].browse(subscription_plan_id)
            pricing = (
                request.env[
                    'sale.subscription.pricing'
                ].sudo()._get_first_suitable_recurring_pricing(
                    product_or_template, plan=subscription_plan, pricelist=pricelist
                )
            )
            if pricing:
                basic_product_information.update({
                    'price': pricing.currency_id._convert(
                        from_amount=pricing.price,
                        to_currency=currency,
                        company=request.env.company,
                        date=date,
                    ),
                    'price_info': pricing.plan_id.billing_period_display_sentence,
                })
        return basic_product_information
