# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class IrConfigParameter(models.Model):
    _inherit = 'ir.config_parameter'

    def _neutralize(self):
        super()._neutralize()
        self.flush()
        self.invalidate_cache()
        self.env.cr.execute("""
            UPDATE ir_config_parameter
            SET value = 'demo'
            WHERE key = 'voip.mode'
        """)
