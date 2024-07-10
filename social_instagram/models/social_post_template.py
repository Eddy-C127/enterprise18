# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import uuid

from odoo import api, fields, models
from odoo.exceptions import UserError
from odoo.tools.image import base64_to_image


class SocialPostTemplate(models.Model):
    _inherit = 'social.post.template'

    def _get_default_access_token(self):
        return str(uuid.uuid4())

    instagram_access_token = fields.Char('Access Token', default=lambda self: self._get_default_access_token(), copy=False,
        help="Used to allow access to Instagram to retrieve the post image")
    display_instagram_preview = fields.Boolean('Display Instagram Preview', compute='_compute_display_instagram_preview')
    instagram_preview = fields.Html('Instagram Preview', compute='_compute_instagram_preview')

    @api.depends('message', 'account_ids.media_id.media_type', 'image_ids')
    def _compute_display_instagram_preview(self):
        for post in self:
            post.display_instagram_preview = (post.message or post.image_ids) and ('instagram' in post.account_ids.media_id.mapped('media_type'))

    @api.depends(lambda self: ['message', 'image_ids', 'display_instagram_preview'] + self._get_post_message_modifying_fields())
    def _compute_instagram_preview(self):
        """ We want to display various error messages if the image is not appropriate.
        See #_get_instagram_image_error() for more information. """

        for post in self:
            if not post.display_instagram_preview:
                post.instagram_preview = False
                continue
            faulty_images, error_code = post._get_instagram_image_error()
            post.instagram_preview = self.env['ir.qweb']._render('social_instagram.instagram_preview', {
                **post._prepare_preview_values("instagram"),
                'faulty_images': faulty_images,
                'error_code': error_code,
                'image_urls': [
                    f'/web/image/{image._origin.id or image.id}'
                    for image in post.image_ids.sorted(lambda image: image._origin.id or image.id, reverse=True)
                ],
                'message': post._prepare_post_content(
                    post.message,
                    'instagram',
                    **{field: post[field] for field in post._get_post_message_modifying_fields()}),
            })

    def _get_instagram_image_error(self):
        """ Allows verifying that the post within self contains a valid Instagram image.

        Returns: faulty image names along with error_code
        Errors:              Causes:
        - 'missing'          If there is no image
        - 'wrong_extension'  If the image in not in the JPEG format
        - 'incorrect_ratio'  If the image in not between 4:5 and 1.91:1 ratio'
        - 'max_limit'        If the number of images is greater than 10 (Carousels are limited to 10 images)
        - 'corrupted'        If the image is corrupted
        - False              If everything is correct.

        Those various rules are imposed by Instagram.
        See: https://developers.facebook.com/docs/instagram-api/reference/ig-user/media

        We want to avoid any kind of dynamic resizing / format change to make sure what the user
        uploads and sees in the preview is as close as possible to what they will get as a result on
        Instagram. """

        self.ensure_one()
        error_code = False
        faulty_images = self.env['ir.attachment']
        jpeg_images = self.image_ids.filtered(lambda image: image.mimetype == 'image/jpeg')
        non_jpeg_images = self.image_ids.filtered(lambda image: image.mimetype != 'image/jpeg')

        if not self.image_ids:
            error_code = 'missing'
        else:
            if len(jpeg_images) > 10:
                error_code = 'max_limit'
            if non_jpeg_images:
                error_code = 'wrong_extension'
                faulty_images += non_jpeg_images
            if jpeg_images and not non_jpeg_images:
                for jpeg_image in jpeg_images:
                    try:
                        image = base64_to_image(jpeg_image.with_context(bin_size=False).datas)
                    except UserError:
                        # image could not be loaded
                        error_code = 'corrupted'
                        return error_code

                    image_ratio = image.width / image.height if image.height else 0
                    if image_ratio < 0.8 or image_ratio > 1.91:
                        error_code = 'incorrect_ratio'
                        faulty_images += jpeg_image

        return faulty_images.mapped('name'), error_code
