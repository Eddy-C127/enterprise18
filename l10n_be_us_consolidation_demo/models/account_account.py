from odoo import api, models, Command


class AccountAccount(models.Model):
    _inherit = ['account.account']

    @api.model
    def _l10n_be_us_consolidation_demo_create_accounts(self):
        accounts_to_create = {
            'main_specific_payable_account': {
                'account_type': 'liability_payable',
                'company_ids': [Command.link(self.env.ref('base.main_company').id)],
                'code': '111110',
                'name': "Account payable IC BE Company",
                'reconcile': True,
            },
            'main_specific_expense_account': {
                'account_type': 'expense',
                'company_ids': [Command.link(self.env.ref('base.main_company').id)],
                'code': '220010',
                'name': "Expenses IC",
                'reconcile': False,
            },
            'be_specific_receivable_account': {
                'account_type': 'asset_receivable',
                'company_ids': [Command.link(self.env.ref('base.demo_company_be').id)],
                'code': '400010',
                'name': "Clients IC YourCompany",
                'reconcile': True,
            },
            'be_specific_income_account': {
                'account_type': 'income',
                'company_ids': [Command.link(self.env.ref('base.demo_company_be').id)],
                'code': '705210',
                'name': "Prestations de services IC",
                'reconcile': False,
                'tag_ids': self.env.ref('account.account_tag_operating'),
            }
        }

        update_xmlid_values = []

        for xml_id, values in accounts_to_create.items():
            xml_id = f'l10n_be_us_consolidation_demo.{xml_id}'
            if not self.env.ref(xml_id, raise_if_not_found=False):
                account = self.env['account.account'].create(values)
                update_xmlid_values.append({
                    'xml_id': xml_id,
                    'noupdate': True,
                    'record': account,
                })

        self.env['ir.model.data']._update_xmlids(update_xmlid_values)
