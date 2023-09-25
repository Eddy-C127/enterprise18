# Part of Odoo. See LICENSE file for full copyright and licensing details.
import requests
from datetime import datetime
from collections import defaultdict

from requests import HTTPError
from werkzeug.urls import url_join
from urllib.parse import quote

from odoo import _, api, fields, models, Command
from odoo.exceptions import UserError, AccessError
from odoo.tools.misc import format_date, format_datetime


class ResCompany(models.Model):
    _inherit = 'res.company'

    employment_hero_enable = fields.Boolean(string='Enable Employment Hero Integration')
    employment_hero_api_key = fields.Char(string='API Key', groups='base.group_system')
    employment_hero_base_url = fields.Char(string='Payroll URL', groups='base.group_system')
    employment_hero_identifier = fields.Char(string='Business Id', groups='base.group_system')
    employment_hero_lock_date = fields.Date(string='Fetch Payrun After', help="Import payruns paid after this date. This date cannot be prior to the Lock Date for All Users.")
    employment_hero_journal_id = fields.Many2one(
        comodel_name='account.journal',
        string='Payroll Journal',
    )

    @api.onchange('fiscalyear_lock_date', 'employment_hero_lock_date')
    def _onchange_exclude_before(self):
        fiscalyear_lock_date = self.fiscalyear_lock_date
        if self.parent_id:
            # We need to use sudo, since we might not have access to a parent company.
            fiscalyear_lock_date = max(fiscalyear_lock_date, self.sudo().parent_id.fiscalyear_lock_date)
        self.employment_hero_lock_date = max(self.employment_hero_lock_date, fiscalyear_lock_date)

    def _eh_payroll_fetch_journal_entries(self, eh_payrun):
        self.ensure_one()
        if not (self.employment_hero_base_url and self.employment_hero_identifier and self.employment_hero_api_key):
            raise UserError(_("The configuration of your Employment Hero integration for company %(company_name)s isn't complete."
                              "Please make sure to fill the api key, url and the business id before retrying.", company_name=self.name))
        # Fetch the journal details: https://api.keypay.com.au/australia/reference/pay-run/au-journal--get
        url = url_join(self.employment_hero_base_url, 'api/v2/business/%s/journal/%s' % (
            quote(self.employment_hero_identifier, safe=''),
            eh_payrun['id'],
        ))
        response = requests.get(url, auth=(self.employment_hero_api_key, ''), timeout=10)
        self._handle_request_errors(response)

        line_ids_commands = []
        tax_results = defaultdict(lambda: {'debit': 0, 'credit': 0})
        journal_items = response.json()
        all_item_account_codes = [journal_item['accountCode'] for journal_item in journal_items]
        item_accounts = self.env['account.account'].search([
            *self.env['account.account']._check_company_domain(self),
            ('deprecated', '=', False),
            '|', ('employment_hero_account_identifier', 'in', all_item_account_codes), ('code', 'in', all_item_account_codes)
        ], order='employment_hero_account_identifier')
        item_taxes = self.env['account.tax'].search([
            *self.env['account.tax']._check_company_domain(self),
            ('employment_hero_tax_identifier', 'in', [journal_item['taxCode'] for journal_item in journal_items])
        ])

        for journal_item in journal_items:
            item_account = next(iter(item_accounts.filtered(
                lambda a: a.employment_hero_account_identifier == journal_item['accountCode'] or a.code == journal_item['accountCode']
            )))
            if not item_account:
                raise UserError(
                    _("Account not found: %(account_code)s, either create an account with that code or link an existing one to that Employment Hero code",
                      account_code=journal_item['accountCode'])
                )

            tax = False
            if journal_item.get('taxCode'):
                tax = next(iter(item_taxes.filtered(lambda t: t.employment_hero_tax_identifier == journal_item['taxCode'])))

            if tax:
                tax_compute_result = self.currency_id.round(tax.with_context(force_price_include=True)._compute_amount(abs(journal_item['amount']), 1.0))
                tax_results[tax.id]['debit' if journal_item['isDebit'] else 'credit'] += tax_compute_result
                amount = abs(journal_item['amount']) - tax_compute_result
            else:
                amount = abs(journal_item['amount'])

            line_ids_commands.append(Command.create({
                'account_id': item_account.id,
                'name': journal_item['reference'],
                'debit': amount if journal_item['isDebit'] else 0,
                'credit': amount if journal_item['isCredit'] else 0,
                'tax_ids': [(4, tax.id, 0)] if tax else False,
            }))

        period_ending_date = datetime.strptime(eh_payrun["payPeriodEnding"], "%Y-%m-%dT%H:%M:%S")

        move = self.env['account.move'].create({
            'journal_id': self.employment_hero_journal_id.id,
            'ref': _("Pay period ending %(end_date)s (#%(payrun_id)s)",
                     end_date=format_date(self.env, period_ending_date),
                     payrun_id=eh_payrun['id']),
            'date': datetime.strptime(eh_payrun["datePaid"], "%Y-%m-%dT%H:%M:%S"),
            'line_ids': line_ids_commands,
            'employment_hero_payrun_identifier': eh_payrun['id'],
        })
        move_update_vals = []
        for move_line in move.line_ids.filtered(lambda l: l.tax_line_id):
            line_val = {}
            if move_line.debit:
                line_val['debit'] = tax_results[move_line.tax_line_id.id]['debit']
            else:
                line_val['credit'] = tax_results[move_line.tax_line_id.id]['credit']
            move_update_vals.append(Command.update(move_line.id, line_val))
        move.write({'line_ids': move_update_vals})

        return move

    def _eh_payroll_fetch_payrun(self):
        self.ensure_one()
        if not self.env.user.has_group('account.group_account_manager'):
            raise AccessError(_("Only the Accountant can fetch Employment Hero payrun."))
        if not (self.employment_hero_api_key and self.employment_hero_identifier and self.employment_hero_journal_id and self.employment_hero_base_url):
            raise UserError(_("The configuration of your Employment Hero integration for company %(company_name)s isn't complete."
                              "Please make sure to fill the api key, url, the business and the payroll journal id before retrying.", company_name=self.name))

        from_formatted_datetime = self.employment_hero_lock_date and datetime.combine(self.employment_hero_lock_date, datetime.min.time()).replace(hour=23, minute=59, second=59)
        from_formatted_datetime = format_datetime(self.env, from_formatted_datetime, dt_format="yyyy-MM-dd'T'HH:mm:ss", tz='UTC')
        filters = "$filter=DatePaid gt datetime'%s'&" % (from_formatted_datetime) if from_formatted_datetime else ''
        offest = 0
        limit = 100
        payruns = []
        while True:
            # Fetch the pay runs: https://api.keypay.com.au/australia/reference/pay-run/au-pay-run--get-pay-runs
            # Use Odata filtering (can only fetch 100 entries at a time): https://api.keypay.com.au/guides/ODataFiltering
            # There is a limit of 5 requests per second but the api do not discard the requests it just waits every 5 answers: https://api.keypay.com.au/guides/Usage
            url = url_join(self.employment_hero_base_url, "api/v2/business/%s/payrun?%s$skip=%d&$top=%d" % (
                quote(self.employment_hero_identifier, safe=''),
                filters,
                offest,
                offest + limit,
            ))
            response = requests.get(url, auth=(self.employment_hero_api_key, ''), timeout=10)
            self._handle_request_errors(response)
            entries = response.json()
            payruns += entries
            if len(entries) < limit:
                break
            offest += limit

        # We cannot filter using the API as we might run into a 414 Client Error: Request-URI Too Large
        payrun_ids = [payrun['id'] for payrun in payruns]
        processed_payrun_ids = self.env['account.move'].search([('company_id', '=', self.id), ('employment_hero_payrun_identifier', 'in', payrun_ids)])
        processed_payruns = processed_payrun_ids.mapped('employment_hero_payrun_identifier')

        account_moves = self.env['account.move']
        for payrun in payruns:
            # Entry needs to be finalized to have a journal entry
            # Currently no way to filter on boolean via the API...
            if not payrun['isFinalised'] or payrun['id'] in processed_payruns:
                continue

            move = self._eh_payroll_fetch_journal_entries(payrun)
            account_moves += move
        return account_moves

    def _eh_payroll_cron_fetch_payrun(self):
        for company in self.search([('employment_hero_enable', '=', True)]):
            company._eh_payroll_fetch_payrun()

    @api.model
    def _handle_request_errors(self, request):
        """ Handle possible errors in a request response by raising a UserError with useful information. """
        try:
            request.raise_for_status()
        except HTTPError:
            raise UserError(_(
                'Employment Hero returned an "%(reason)s" error for the url: %(url)s\n\n%(error)s',
                reason=request.reason,
                url=request.url,
                error=request.text,
            ))
