# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, _, api


class CommissionPlanAchievement(models.Model):
    _name = 'sale.commission.achievement'
    _description = 'Manual Commission Achievement'
    _order = 'id desc'

    plan_id = fields.Many2one('sale.commission.plan', "Commission Plan", required=True, ondelete='cascade')
    user_id = fields.Many2one('res.users', "Sales Person", required=True)
    team_id = fields.Many2one('crm.team', related='user_id.sale_team_id', depends=['user_id'], store=True, required=True, readonly=False)
    achieved = fields.Float("Achieved", required=True)
    currency_id = fields.Many2one('res.currency', "Currency", required=True)
    date = fields.Date("Date", required=True)
    note = fields.Char("Note")
    display_name = fields.Char(compute="_compute_display_name")

    @api.depends('note')
    def _compute_display_name(self):
        for achievement in self:
            if achievement.note:
                achievement.display_name = _("Adjustment: %s", achievement.note)
            else:
                achievement.display_name = _("Adjustment %s", achievement.id)
