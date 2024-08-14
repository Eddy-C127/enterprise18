# Part of Odoo. See LICENSE file for full copyright and licensing details.

from math import ceil

from odoo import _, fields
from odoo.http import request, route

from odoo.addons.sale.controllers.product_configurator import SaleProductConfiguratorController


class SaleRentingProductConfiguratorController(SaleProductConfiguratorController):

    @route()
    def sale_product_configurator_get_values(self, *args, **kwargs):
        self._convert_rental_dates(kwargs)
        return super().sale_product_configurator_get_values(*args, **kwargs)

    @route()
    def sale_product_configurator_update_combination(self, *args, **kwargs):
        self._convert_rental_dates(kwargs)
        return super().sale_product_configurator_update_combination(*args, **kwargs)

    @route()
    def sale_product_configurator_get_optional_products(self, *args, **kwargs):
        self._convert_rental_dates(kwargs)
        return super().sale_product_configurator_get_optional_products(*args, **kwargs)

    def _get_basic_product_information(
        self,
        product_or_template,
        pricelist,
        combination,
        currency=None,
        start_date=None,
        end_date=None,
        **kwargs,
    ):
        """ Override of `sale` to append rental data.

        :param product.product|product.template product_or_template: The product for which to seek
            information.
        :param product.pricelist pricelist: The pricelist to use.
        :param product.template.attribute.value combination: The combination of the product.
        :param res.currency|None currency: The currency of the transaction.
        :param datetime|None start_date: The rental start date, to compute the rental duration.
        :param datetime|None end_date: The rental end date, to compute the rental duration.
        :param dict kwargs: Locally unused data passed to `super`.
        :rtype: dict
        :return: A dict with the following structure:
            {
                ...  # fields from `super`.
                'price_info': str,
            }
        """
        basic_product_information = super()._get_basic_product_information(
            product_or_template,
            pricelist,
            combination,
            currency=currency,
            start_date=start_date,
            end_date=end_date,
            **kwargs,
        )

        if product_or_template.rent_ok:
            ProductPricing = request.env['product.pricing']
            pricing = ProductPricing._get_first_suitable_pricing(product_or_template, pricelist)
            if pricing:
                if start_date and end_date:
                    pricing = product_or_template._get_best_pricing_rule(
                        start_date=start_date,
                        end_date=end_date,
                        pricelist=pricelist,
                        currency=currency,
                    )
                    rental_duration = ProductPricing._compute_duration_vals(
                        start_date, end_date
                    )[pricing.recurrence_id.unit]
                else:
                    rental_duration = pricing.recurrence_id.duration
                # Some locales might swap the duration and the unit, so we need to use the
                # translation function.
                basic_product_information['price_info'] = _(
                    "%(duration)s %(unit)s",
                    duration=ceil(rental_duration),
                    unit=pricing.recurrence_id._get_unit_label(rental_duration),
                )
        return basic_product_information

    @staticmethod
    def _convert_rental_dates(kwargs):
        kwargs.update({
            'start_date': fields.Datetime.to_datetime(kwargs.get('start_date')),
            'end_date': fields.Datetime.to_datetime(kwargs.get('end_date')),
        })
