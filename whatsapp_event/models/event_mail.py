# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class EventMailScheduler(models.Model):
    _inherit = 'event.mail'

    notification_type = fields.Selection(selection_add=[('whatsapp', 'WhatsApp')])
    template_ref = fields.Reference(ondelete={'whatsapp.template': 'cascade'}, selection_add=[('whatsapp.template', 'WhatsApp')])

    @api.constrains('template_ref')
    def _check_whatsapp_template_phone_field(self):
        for record in self:
            if record.notification_type == 'whatsapp' and not record.template_ref.phone_field:
                raise ValidationError(_('Whatsapp Templates in Events must have a phone field set.'))

    def _compute_notification_type(self):
        super()._compute_notification_type()
        social_schedulers = self.filtered(lambda scheduler: scheduler.template_ref and scheduler.template_ref._name == 'whatsapp.template')
        social_schedulers.notification_type = 'whatsapp'

    def execute(self):
        def send_whatsapp(scheduler, registrations):
            if registrations:
                self.env['whatsapp.composer'].with_context({'active_ids': registrations.ids}).create({
                    'res_model': 'event.registration',
                    'wa_template_id': scheduler.template_ref.id
                })._send_whatsapp_template(force_send_by_cron=True)
            scheduler.update({
                'mail_done': True,
                'mail_count_done': len(scheduler.event_id.registration_ids.filtered(lambda r: r.state != 'cancel')),
            })
        now = self.env.cr.now()
        wa_schedulers = self.filtered(lambda s: s.notification_type == "whatsapp" and s.interval_type != "after_sub")
        # no template / wrong template -> ill configured, skip and avoid crash
        for scheduler in wa_schedulers._filter_wa_template_ref():
            # do not send whatsapp if the whatsapp was scheduled before the event but the event is over
            if scheduler.scheduled_date <= now and (scheduler.interval_type != 'before_event' or scheduler.event_id.date_end > now):
                registrations = scheduler.event_id.registration_ids.filtered(lambda registration: registration.state != 'cancel')
                send_whatsapp(scheduler, registrations)
        return super().execute()

    def _filter_wa_template_ref(self):
        """ Check for valid template reference: existing, working template """
        wa_schedulers = self.filtered(lambda s: s.notification_type == "whatsapp")
        if not wa_schedulers:
            return self.browse()
        existing_templates = wa_schedulers.template_ref.exists()
        missing = wa_schedulers.filtered(lambda s: s.template_ref not in existing_templates)
        for scheduler in missing:
            _logger.warning(
                "Cannot process scheduler %s (event %s) as it refers to non-existent whatsapp template %s",
                scheduler.id, scheduler.event_id.name, scheduler.template_ref.id
            )
        invalid = wa_schedulers.filtered(
            lambda scheduler: scheduler not in missing
                              and (scheduler.template_ref._name != "whatsapp.template" or scheduler.template_ref.status != 'approved')
        )
        for scheduler in invalid:
            _logger.warning(
                "Cannot process scheduler %s (event %s) as it refers to invalid whatsapp template %s (ID %s)",
                scheduler.id, scheduler.event_id.name, scheduler.template_ref.name, scheduler.template_ref.id)
        return self - missing - invalid
