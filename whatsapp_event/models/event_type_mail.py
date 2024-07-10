# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class EventTypeMail(models.Model):
    _inherit = 'event.type.mail'

    template_ref = fields.Reference(ondelete={'whatsapp.template': 'cascade'}, selection_add=[('whatsapp.template', 'WhatsApp')])

    def _compute_notification_type(self):
        super()._compute_notification_type()
        social_schedulers = self.filtered(lambda scheduler: scheduler.template_ref and scheduler.template_ref._name == 'whatsapp.template')
        social_schedulers.notification_type = 'whatsapp'
