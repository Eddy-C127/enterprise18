# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import models, _
from odoo.addons.phone_validation.tools import phone_validation

_logger = logging.getLogger(__name__)


class ResPartner(models.Model):
    _inherit = 'res.partner'

    def _find_or_create_from_number(self, number, name=False):
        """ Number should come currently from whatsapp and contain country info. """
        number_with_sign = '+' + number
        try:
            format_number = phone_validation.phone_format(number_with_sign, False, False)
        except Exception:  # noqa: BLE001 don't want to crash in that point, whatever the issue
            _logger.warning('WhatsApp: impossible to format incoming number %s, skipping partner creation', number_with_sign)
            format_number = False
        if not number or not format_number:
            return self.env['res.partner']

        partner = self.env['res.partner'].search(
            ['|', ('mobile', '=', format_number), ('phone', '=', format_number)],
            limit=1
        )
        if not partner:
            # find country / local number based on formatted number to ease future searches
            region_data = phone_validation.phone_get_region_data_for_number(format_number)
            number_country_code = region_data['code']
            number_phone_code = int(region_data['phone_code'])

            # in case of duplicate country phone code, use region (country) code
            # as additional filter (not sure there is a 1 to 1 mapping hence doing
            # it in two steps)
            country = self.env['res.country'].search([('phone_code', '=', number_phone_code)])
            if len(country) > 1:
                country = country.filtered(lambda c: c.code.lower() == number_country_code.lower())

            partner = self.env['res.partner'].create({
                'country_id': country.id if country and len(country) == 1 else False,
                'mobile': format_number,
                'name': name or format_number,
            })
            partner._message_log(
                body=_("Partner created by incoming WhatsApp message.")
            )
        return partner
