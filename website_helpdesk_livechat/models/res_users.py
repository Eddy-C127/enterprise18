# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models

class Users(models.Model):
    _inherit = 'res.users'

    def _init_messaging(self, store):
        super()._init_messaging(store)
        helpdesk_livechat_active = self.env['helpdesk.team'].sudo().search_count([('use_website_helpdesk_livechat', '=', True)], limit=1)
        store.add({
            "Store": {
                "helpdesk_livechat_active": bool(helpdesk_livechat_active),
            },
        })
