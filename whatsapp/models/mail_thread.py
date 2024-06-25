# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.addons.mail.tools.discuss import Store


class MailThread(models.AbstractModel):
    _inherit = 'mail.thread'

    def _to_store(self, store: Store, request_list):
        super()._to_store(store, request_list)
        store.add(
            "Thread",
            {
                "canSendWhatsapp": self.env['whatsapp.template']._can_use_whatsapp(self._name),
                "id": self.id,
                "model": self._name,
            },
        )
