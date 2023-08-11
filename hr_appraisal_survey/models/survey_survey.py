# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from werkzeug.urls import url_encode

class SurveySurvey(models.Model):
    _inherit = 'survey.survey'

    survey_type = fields.Selection(selection_add=[('appraisal', 'Appraisal')], ondelete={'appraisal': 'set default'})

    @api.onchange('survey_type')
    def _onchange_survey_type(self):
        super()._onchange_survey_type()
        if self.survey_type == 'appraisal':
            self.write({
                'access_mode': 'token',
                'is_attempts_limited': True,
                'users_can_go_back': True,
            })

    @api.depends('survey_type')
    @api.depends_context('uid')
    def _compute_allowed_survey_types(self):
        super()._compute_allowed_survey_types()
        if self.env.user.has_group('hr_appraisal.group_hr_appraisal_user') or \
                self.env.user.has_group('survey.group_survey_user'):
            self.allowed_survey_types = (self.allowed_survey_types or []) + [('appraisal', 'Appraisal')]

    def action_open_all_survey_inputs(self):
        return {
            'type': 'ir.actions.act_url',
            'name': _("Survey Feedback"),
            'target': 'self',
            'url': '/appraisal/%s/results/' % (self.id)
        }

    def action_survey_user_input_completed(self):
        action = super().action_survey_user_input_completed()
        if self.survey_type == 'appraisal':
            action.update({
                'domain': [('survey_id.survey_type', '=', 'appraisal')]
            })
        return action

    def action_survey_user_input(self):
        action = super().action_survey_user_input()
        if self.survey_type == 'appraisal':
            action.update({
                'domain': [('survey_id.survey_type', '=', 'appraisal')]
            })
        return action

    def get_formview_id(self, access_uid=None):
        if self.survey_type == 'appraisal':
            access_user = self.env['res.users'].browse(access_uid) if access_uid else self.env.user
            if not access_user.has_group('survey.group_survey_user'):
                if view := self.env.ref('hr_appraisal_survey.survey_survey_view_form', raise_if_not_found=False):
                    return view.id
        return super().get_formview_id(access_uid=access_uid)


class SurveyUserInput(models.Model):
    _inherit = 'survey.user_input'

    appraisal_id = fields.Many2one('hr.appraisal')
    requested_by = fields.Many2one(related="create_uid.partner_id", string='Requested by')

    def action_open_survey_inputs(self):
        self.ensure_one()
        return {
            'name': _("Survey Feedback"),
            'type': 'ir.actions.act_url',
            'target': 'new',
            'url': '/survey/print/%s?%s' %
                   (self.survey_id.access_token, url_encode({"answer_token": self.access_token, "review": True}))
        }

    def action_open_all_survey_inputs(self):
        return {
            'type': 'ir.actions.act_url',
            'name': _("Survey Feedback"),
            'target': 'new',
            'url': '/survey/results/%s?%s' %
                   (self.survey_id[0].id, url_encode({"appraisal_id": self.appraisal_id.id}))
        }

    def action_ask_feedback(self):
        return {
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'appraisal.ask.feedback',
            'target': 'new',
            'name': 'Ask Feedback',
            'context': {
                'default_appraisal_id': self.appraisal_id.id,
                'default_employee_ids': self.appraisal_id.employee_feedback_ids.filtered(
                    lambda e: e.work_email == self.email or e.user_id.partner_id.email == self.email).ids,
                'default_survey_template_id': self.survey_id.id
            }
        }

class SurveyQuestionAnswer(models.Model):
    _inherit = 'survey.question.answer'

    survey_id = fields.Many2one('survey.survey', related='question_id.survey_id')
