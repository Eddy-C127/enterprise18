# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = "res.company"

    l10n_au_hr_super_responsible_id = fields.Many2one(
        "hr.employee",
        string="HR Super Sender",
        help="The employee responsible for sending Super")
