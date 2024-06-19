from odoo import api, models, fields, _
from odoo.exceptions import ValidationError


class AccountReportBudget(models.Model):
    _name = 'account.report.budget'
    _description = "Accounting Report Budget"
    _order = 'sequence, id'

    sequence = fields.Integer(string="Sequence")
    name = fields.Char(string="Name", required=True)
    item_ids = fields.One2many(string="Items", comodel_name='account.report.budget.item', inverse_name='budget_id')
    company_id = fields.Many2one(string="Company", comodel_name='res.company', required=True, default=lambda x: x.env.company)


class AccountReportBudgetItem(models.Model):
    _name = 'account.report.budget.item'
    _description = "Accounting Report Budget Item"

    budget_id = fields.Many2one(string="Budget", comodel_name='account.report.budget', required=True, ondelete='cascade')
    account_id = fields.Many2one(string="Account", comodel_name='account.account', required=True)
    amount = fields.Float(string="Amount", default=0)

    @api.constrains('budget_id', 'account_id')
    def _check_double_account(self):
        for record in self:
            if len(record.budget_id.item_ids.filtered(lambda x: x.account_id == record.account_id)) > 1:
                raise ValidationError(_("Account '%s' is present multiple times in this budget.", record.account_id.display_name))
