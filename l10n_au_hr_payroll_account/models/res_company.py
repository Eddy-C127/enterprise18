# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class ResCompany(models.Model):
    _inherit = "res.company"

    l10n_au_hr_super_responsible_id = fields.Many2one(
        "hr.employee",
        string="HR Super Sender",
        help="The employee responsible for sending Super")

    l10n_au_stp_responsible_id = fields.Many2one("hr.employee", string="STP Responsible")

    @api.constrains('l10n_au_hr_super_responsible_id', 'l10n_au_stp_responsible_id')
    def _check_payroll_responsible_fields(self):
        for company in self:
            if company.l10n_au_hr_super_responsible_id and not company.l10n_au_hr_super_responsible_id.user_id.exists():
                raise ValidationError(_("The HR Super Sender must be linked to a user."))
            if company.l10n_au_stp_responsible_id and not company.l10n_au_stp_responsible_id.user_id.exists():
                raise ValidationError(_("The STP Responsible must be linked to a user."))
