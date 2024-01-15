# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _lt

class Project(models.Model):
    _inherit = 'project.project'

    assets_count = fields.Integer('# Assets', compute='_compute_assets_count', groups='account.group_account_readonly')

    @api.depends('analytic_account_id')
    def _compute_assets_count(self):
        data = self.env['account.asset']._read_group(
            [('analytic_distribution', 'in', self.analytic_account_id.ids)],
            ['analytic_distribution'],
            ['__count'],
        )
        data = {int(account_id): count for account_id, count in data}
        for project in self:
            project.assets_count = data.get(project.analytic_account_id.id, 0)

    # -------------------------------------
    # Actions
    # -------------------------------------

    def action_open_project_assets(self):
        assets = self.env['account.asset'].search(
            [('analytic_distribution', 'in', self.analytic_account_id.ids)],
        )
        action = self.env["ir.actions.actions"]._for_xml_id("account_asset.action_account_asset_form")
        action.update({
            'views': [[False, 'tree'], [False, 'form'], [False, 'kanban']],
            'context': {'default_analytic_distribution': {self.analytic_account_id.id: 100}},
            'domain': [('id', 'in', assets.ids)]
        })
        if(len(assets) == 1):
            action["views"] = [[False, 'form']]
            action["res_id"] = assets[0].id
        return action

    # ----------------------------
    #  Project Updates
    # ----------------------------

    def _get_stat_buttons(self):
        buttons = super(Project, self)._get_stat_buttons()
        if self.user_has_groups('account.group_account_readonly'):
            buttons.append({
                'icon': 'pencil-square-o',
                'text': _lt('Assets'),
                'number': self.sudo().assets_count,
                'action_type': 'object',
                'action': 'action_open_project_assets',
                'show': self.sudo().assets_count > 0,
                'sequence': 40,
            })
        return buttons
