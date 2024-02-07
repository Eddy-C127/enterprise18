# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models
from odoo.osv import expression


class Article(models.Model):
    _name = 'knowledge.article'
    _inherit = ['knowledge.article', 'website.published.mixin', 'website.searchable.mixin']

    @api.depends('article_url')
    def _compute_website_url(self):
        for record in self:
            record.website_url = record.article_url

    def write(self, vals):
        """When writing on an article we check if we write on website_published or is_published,
        if that's the case we propagate the change to its children. This way we can publish small
        sub sites containing only a part of the published articles.
        """
        if self.env.context.get('ignore_published_propagation'):
            return super().write(vals)
        if 'website_published' in vals or 'is_published' in vals:
            new_published_state = vals.get('website_published', False) or vals.get('is_published', False)
            self.env['knowledge.article'].search([
                ('id', 'child_of', self.ids),
                ('id', 'not in', self.ids),
            ]).with_context({'ignore_published_propagation': True}).write({
                'website_published': new_published_state,
            })
        return super().write(vals)

    def _prepare_article_create_values(self, title=False, parent_id=False, is_private=False, is_article_item=False, article_properties=False):
        values = super()._prepare_article_create_values(title, parent_id, is_private, is_article_item, article_properties)

        if parent_id:
            parent_article = self.env['knowledge.article'].browse(parent_id)
            if parent_article.website_published:
                values['website_published'] = True
        return values

    def _get_read_domain(self):
        return expression.OR([
            super()._get_read_domain(),
            [('website_published', '=', True)]
        ])

    def get_backend_menu_id(self):
        return self.env.ref('knowledge.knowledge_menu_root').id

    @api.model
    def _search_get_detail(self, website, order, options):
        domain = ['|', ('user_has_access', '=', True), ('is_published', '=', True)]
        if options.get('max_date'):
            domain = expression.AND([[('create_date', '>=', options['max_date'])], domain])
        mapping = {
            'name': {'name': 'name', 'type': 'text', 'match': True},
            'website_url': {'name': 'website_url', 'type': 'text', 'truncate': False},
            'body': {'name': 'body', 'type': 'text', 'html': True, 'match': True},
        }
        return {
            'model': 'knowledge.article',
            'base_domain': [domain],
            'search_fields': ['name', 'body'],
            'fetch_fields': ['id', 'name', 'body', 'website_url'],
            'mapping': mapping,
            'icon': 'fa-comment-o',
            'order': order,
        }
