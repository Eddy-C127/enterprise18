# -*- coding: utf-8 -*-
from odoo import fields, models


class WorkflowActionRuleApplicant(models.Model):
    _inherit = ['documents.workflow.rule']

    create_model = fields.Selection(selection_add=[('hr.candidate', "Candidate")])

    def create_record(self, documents=None):
        rv = super(WorkflowActionRuleApplicant, self).create_record(documents=documents)
        if self.create_model == 'hr.candidate':
            candidates = self.env['hr.candidate']
            for document in documents:
                candidate = self.env['hr.candidate'].create({
                    'partner_name': "New Candidate from Documents",
                    'user_id': False,
                })
                candidates |= candidate
                this_document = document
                if (document.res_model or document.res_id) and document.res_model != 'documents.document':
                    this_document = document.copy()
                    attachment_id_copy = document.attachment_id.with_context(no_document=True).copy()
                    this_document.write({'attachment_id': attachment_id_copy.id})

                this_document.attachment_id.with_context(no_document=True).write({
                    'res_model': 'hr.candidate',
                    'res_id': candidate.id
                })
            action = {
                'type': 'ir.actions.act_window',
                'res_model': 'hr.candidate',
                'name': 'Candidate',
                'view_mode': 'tree,form',
                'views': [(False, "list"), (False, "form")],
                'domain': [('id', 'in', candidates.ids)],
                'context': self._context,
            }
            if len(candidates) == 1:
                action.update(
                    view_mode='form',
                    views=[(False, "form")],
                    res_id=candidates[0].id,
                )
            return action
        return rv
