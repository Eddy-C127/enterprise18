# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.addons.mail.tools.discuss import Store


class MailThread(models.AbstractModel):
    _inherit = 'mail.thread'

    def _thread_to_store(self, store: Store, **kwargs):
        super()._thread_to_store(store, **kwargs)
        store.add(
            "Thread",
            {
                "canSendWhatsapp": self.env['whatsapp.template']._can_use_whatsapp(self._name),
                "id": self.id,
                "model": self._name,
            },
        )
