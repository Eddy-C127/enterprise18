# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class HREmployee(models.Model):
    _inherit = "hr.employee"

    l10n_bd_disabled = fields.Boolean(string="BD: Disabled", tracking=True)
    l10n_bd_disabled_dependent = fields.Integer(string="Number of disabled dependent people", tracking=True)
    l10n_bd_gazetted_war_founded_freedom_fighter = fields.Boolean(
        string="Gazetted War-Founded Freedom Fighter",
        help="This value is used to know how much of your taxable income is exempt from the income tax computation.",
        tracking=True)
