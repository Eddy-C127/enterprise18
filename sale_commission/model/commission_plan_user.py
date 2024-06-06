# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from odoo import models, fields, exceptions, _, api


class CommissionPlanUser(models.Model):
    _name = 'sale.commission.plan.user'
    _description = 'Commission Plan User'
    _order = 'id'

    plan_id = fields.Many2one('sale.commission.plan', required=True, ondelete='cascade')
    user_id = fields.Many2one('res.users', "Salesperson", required=True, domain="[('share', '=', False)]")
    team_id = fields.Many2one('crm.team', compute='_compute_team_id', store=True, readonly=False)

    date_from = fields.Date("From", compute='_compute_date', store=True, readonly=False, required=True, precompute=True)
    date_to = fields.Date("To", compute='_compute_date', store=True, readonly=False, required=True, precompute=True)

    note = fields.Char("Note", compute='_compute_note')

    _sql_constraints = [
        ('user_uniq', 'unique (plan_id, user_id, team_id)', "The user is already present in the plan"),
    ]

    @api.constrains('date_from', 'date_to')
    def _date_constraint(self):
        for user in self:
            if user.date_to < user.date_from:
                raise exceptions.UserError(_("From must be before To"))
            if user.date_from < user.plan_id.date_from:
                raise exceptions.UserError(_("User period cannot start before the plan."))
            if user.date_to > user.plan_id.date_to:
                raise exceptions.UserError(_("User period cannot end after the plan."))

    @api.depends('user_id')
    def _compute_team_id(self):
        for user in self:
            user.team_id = user.user_id.sale_team_id

    @api.depends('user_id')
    def _compute_note(self):
        grouped_users = defaultdict(lambda: self.env['sale.commission.plan.user'])
        for user in self | self.search([('user_id', 'in', self.user_id.ids), ('plan_id.state', 'in', ['draft', 'approved'])]):
            grouped_users[user.user_id] += user

        for res_user, plan_user in grouped_users.items():
            if len(plan_user) > 1:
                plan_user.note = _("User is currently in multiple plans: %s", ", ".join(plan_user.plan_id.mapped('name')))
            else:
                plan_user.note = ''

    @api.depends('plan_id')
    def _compute_date(self):
        today = fields.Date.today()
        for user in self:
            if user.date_from or user.date_to:
                return
            if not user.plan_id.date_from or not user.plan_id.date_to:
                return
            user.date_from = max(user.plan_id.date_from, today) if user.plan_id.state != 'draft' else user.plan_id.date_from
            user.date_to = user.plan_id.date_to
