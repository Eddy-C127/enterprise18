# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models
from odoo.osv import expression


class TagsCategories(models.Model):
    _inherit = "documents.facet"

    def default_get(self, fields):
        res = super().default_get(fields)
        if self.env.context.get('documents_project_folder') and not res.get('folder_id'):
            res['folder_id'] = self.env.context.get('documents_project_folder')
        return res

    def _get_facet_domain(self, domain):
        if 'documents_project_folder' not in self.env.context:
            return None
        folder_id = self.env.context.get('documents_project_folder')
        return expression.AND([
            domain,
            [('folder_id', '=', folder_id)],
        ])

    @api.model
    def _search_display_name(self, operator, value):
        domain = super()._search_display_name(operator, value)
        domain = self._get_facet_domain(domain)
        return domain

    @api.model
    def search_read(self, domain=None, fields=None, offset=0, limit=None, order=None, **read_kwargs):
        return super().search_read(self._get_facet_domain(domain), fields, offset, limit, order, **read_kwargs)
