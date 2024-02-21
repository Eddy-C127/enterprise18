# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from urllib.parse import urlparse

from odoo import api, fields, models, _


class SocialPostTemplate(models.Model):
    _inherit = 'social.post.template'

    twitter_preview = fields.Html('X Preview', compute='_compute_twitter_preview')
    has_twitter_accounts = fields.Boolean('Display X Preview', compute='_compute_has_twitter_accounts')
    twitter_post_limit_message = fields.Char('X Post Limit Message', compute="_compute_twitter_post_limit_message")
    is_twitter_post_limit_exceed = fields.Boolean('X Post Limit Exceeded', compute="_compute_twitter_post_limit_message")

    @api.depends('account_ids.media_id.media_type')
    def _compute_has_twitter_accounts(self):
        for post in self:
            post.has_twitter_accounts = 'twitter' in post.account_ids.media_id.mapped('media_type')

    @api.depends('message', 'has_twitter_accounts')
    def _compute_twitter_post_limit_message(self):
        self.twitter_post_limit_message = False
        self.is_twitter_post_limit_exceed = False
        for post in self.filtered('has_twitter_accounts'):
            twitter_account = post.account_ids._filter_by_media_types(['twitter'])
            post.twitter_post_limit_message = _("%s / %s characters to fit in a Post", post.message_length, twitter_account.media_id.max_post_length)
            post.is_twitter_post_limit_exceed = twitter_account.media_id.max_post_length and post.message_length > twitter_account.media_id.max_post_length

    @api.depends(lambda self: ['message', 'image_ids', 'is_twitter_post_limit_exceed', 'has_twitter_accounts'] + self._get_post_message_modifying_fields())
    def _compute_twitter_preview(self):
        self.twitter_preview = False
        for post in self.filtered('has_twitter_accounts'):
            twitter_account = post.account_ids._filter_by_media_types(['twitter'])

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

            post.twitter_preview = self.env['ir.qweb']._render('social_twitter.twitter_preview', {
                **post._prepare_preview_values('twitter'),
                'message': post._prepare_post_content(
                    post.message,
                    'twitter',
                    **{field: post[field] for field in post._get_post_message_modifying_fields()}),
                'image_urls': image_urls,
                'limit': twitter_account.media_id.max_post_length,
                'is_twitter_post_limit_exceed': post.is_twitter_post_limit_exceed,
                'link_preview': link_preview,
            })
