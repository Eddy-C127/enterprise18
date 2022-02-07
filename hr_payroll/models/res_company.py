# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, _


class ResCompany(models.Model):
    _inherit = "res.company"

    def _create_dashboard_notes(self):
        dashboard_note_tag = self.env.ref('hr_payroll.payroll_note_tag', raise_if_not_found=False)
        if not dashboard_note_tag:
            return
        payroll_users = self.env.ref('hr_payroll.group_hr_payroll_user').users
        for company in self:
            company_payroll_users = payroll_users.filtered(lambda u: company in u.company_ids)
            if not company_payroll_users:
                continue
            note = self.env['note.note'].create({
                'tag_ids': [(4, dashboard_note_tag.id)],
                'name': _('Useful Links'),
            })
            note.message_subscribe(partner_ids=company_payroll_users.partner_id.ids)

    @api.model_create_multi
    def create(self, vals_list):
        companies = super().create(vals_list)
        companies._create_dashboard_notes()
        return companies
