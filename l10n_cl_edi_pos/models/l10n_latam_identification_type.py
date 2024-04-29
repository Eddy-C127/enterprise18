# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api


class L10nLatamIdentificationType(models.Model):
    _inherit = 'l10n_latam.identification.type'

    @api.model
    def _load_pos_data_fields(self, config_id):
        result = super()._load_pos_data_fields(config_id)
        if self.env.company.country_id.code == 'CL':
            return ['name']
        return result

    def _load_pos_data_domain(self, data):
        result = super()._load_pos_data_domain(data)
        if self.env.company.country_id.code == 'CL':
            return [('active', '=', True)]
        return result
