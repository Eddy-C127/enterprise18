from . import controllers
from . import models

import uuid


def _urban_piper_pos_init(env):
    env['ir.config_parameter'].sudo().set_param('pos_urban_piper.uuid', str(uuid.uuid4()))
