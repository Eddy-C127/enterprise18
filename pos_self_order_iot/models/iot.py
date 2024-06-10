import json
import requests
from odoo import _, api, fields, models
from odoo.exceptions import UserError

MIN_VERSION_FOR_KIOSK = 24.08


class IotBox(models.Model):
    _inherit = 'iot.box'

    screen_orientation = fields.Selection(
        selection=[
            ('normal', 'Normal'),
            ('right', 'Right'),
            ('left', 'Left'),
            ('inverted', 'Inverted'),
        ],
        string='Screen Orientation',
        help='Select the orientation of the screen for the Kiosk mode',
        default='normal',
    )
    can_be_kiosk = fields.Boolean(compute='_compute_can_be_kiosk', store=True)
    pos_id = fields.Many2one('pos.config', string='Linked To Point of Sale')

    def get_computed_img_version(self):
        # Once connected to db, version is like 'L24.08-17.0#f30b83ff': we need to extract between 'L' and '-'
        try:
            version_str = self.version.split('L')[1].split('-')[0]
            return float(version_str)
        except IndexError:
            return float(self.version)
        except ValueError:
            return 0.0

    @api.onchange('screen_orientation')
    def _onchange_screen_orientation(self):
        try:
            requests.post(
                f'http://{self.ip}/hw_proxy/rotate_screen',
                headers={'Content-Type': 'application/json'},
                data=json.dumps({"params": {'orientation': self.screen_orientation}}),
                timeout=5,
            )
        except requests.exceptions.RequestException:
            raise UserError(_("Could not connect to the IoT Box"))

    @api.depends('device_ids.type', 'version')
    def _compute_can_be_kiosk(self):
        for record in self:
            device_types = {device.type for device in record.device_ids}
            # Kiosk mode is only available for devices with a display and a keyboard
            # Images before 24.08 need to delete /etc/X11/xorg.conf to be able to use xrandr to rotate the screen
            record.can_be_kiosk = (
                    'display' in device_types
                    and 'keyboard' in device_types
                    and record.get_computed_img_version() >= MIN_VERSION_FOR_KIOSK
            )

    @api.onchange('device_ids')
    def _onchange_device_ids(self):
        self._compute_can_be_kiosk()
