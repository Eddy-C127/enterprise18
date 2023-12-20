# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from urllib.parse import urlparse

from odoo import api, fields, models


class SocialPostTemplate(models.Model):
    _inherit = 'social.post.template'

    facebook_preview = fields.Html('Facebook Preview', compute='_compute_facebook_preview')
    display_facebook_preview = fields.Boolean('Display Facebook Preview', compute='_compute_display_facebook_preview')

    @api.depends('message', 'account_ids.media_id.media_type')
    def _compute_display_facebook_preview(self):
        for post in self:
            post.display_facebook_preview = post.message and ('facebook' in post.account_ids.media_id.mapped('media_type'))

    @api.depends(lambda self: ['message', 'image_ids', 'display_facebook_preview'] + self._get_post_message_modifying_fields())
    def _compute_facebook_preview(self):
        for post in self:
            if not post.display_facebook_preview:
                post.facebook_preview = False
                continue

            image_urls = []
            link_preview = {}
            if post.image_ids:
                image_urls = [
                    f'/web/image/{image._origin.id or image.id}'
                    for image in post.image_ids.sorted(lambda image: image._origin.id or image.id, reverse=True)
                ]
            elif url_in_message := self.env['social.post']._extract_url_from_message(post.message):
                preview = self.env['mail.link.preview'].sudo()._search_or_create_from_url(url_in_message) or {}
                link_preview['url'] = url_in_message
                link_preview['domain'] = urlparse(url_in_message).hostname
                if image_url := preview.get('og_image'):
                    image_urls.append(image_url)
                if title := preview.get('og_title'):
                    link_preview['title'] = title
                if description := preview.get('og_description'):
                    link_preview['description'] = description

            post.facebook_preview = self.env['ir.qweb']._render('social_facebook.facebook_preview', {
                **post._prepare_preview_values("facebook"),
                'message': post._prepare_post_content(
                    post.message,
                    'facebook',
                    **{field: post[field] for field in post._get_post_message_modifying_fields()}),
                'image_urls': image_urls,
                'link_preview': link_preview,
            })
