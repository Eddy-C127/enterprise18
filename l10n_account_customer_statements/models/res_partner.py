# Part of Odoo. See LICENSE file for full copyright and licensing details.
import uuid

from collections import defaultdict
from dateutil.relativedelta import relativedelta

from odoo import _, fields, models, api
from odoo.exceptions import UserError
from odoo.tools.misc import format_date
from odoo.tools.date_utils import end_of


class ResPartner(models.Model):
    _inherit = ['res.partner']

    next_customer_statement_date = fields.Date(
        string="Next Statement Date",
        compute="_compute_next_statement_date",
        store=True,
        readonly=False,
    )
    automatic_customer_statement_enabled = fields.Boolean(
        string='Frequency',
        help='By Enabling this option, customer statements will be sent to this partner at a fixed frequency that you can control.'
    )
    customer_statement_interval = fields.Integer(default=1)
    customer_statement_frequency = fields.Selection(
        selection=[
            ('weeks', 'Weeks'),
            ('months', 'Months'),
        ],
        default='months',
        string="Send Every",
    )
    customer_statement_access_token = fields.Char('Security Token', copy=False)

    def _ensure_customer_statement_token(self):
        """ Get the current record access token """
        if not self.customer_statement_access_token:
            self.sudo().write({'customer_statement_access_token': str(uuid.uuid4())})
        return self.customer_statement_access_token

    @api.depends('customer_statement_interval', 'customer_statement_frequency', 'automatic_customer_statement_enabled')
    def _compute_next_statement_date(self):
        """ Default the next statement date to the end of the current month or week. """
        for partner in self:
            if not partner.automatic_customer_statement_enabled or not partner.customer_statement_frequency:
                partner.next_customer_statement_date = False
                continue

            granularity = 'month' if partner.customer_statement_frequency == 'months' else 'week'
            partner.next_customer_statement_date = end_of(fields.Date.today(), granularity)

    def _update_next_customer_statement_date(self):
        for partner in self:
            partner.next_customer_statement_date += relativedelta(**{
                partner.customer_statement_frequency: partner.customer_statement_interval
            })

    def action_print_customer_statements(self, options=None):
        """The customer statement is a report that is based on the partner ledger, with a few differences.
        It is commonly sent each month to every customer with purchases during the month.
        """
        return self.env.ref('l10n_account_customer_statements.action_customer_statements_report').with_context(
            report_options=options
        ).report_action(self)

    def _prepare_customer_statement_values(self, options=None):
        def format_monetary(value):
            return self.env['account.report'].format_value(
                options=options,
                value=value,
                figure_type='monetary',
            )

        # This usually can't happen, BUT it could if you try to somehow print
        # the customer statements from the 'Unknown Partner' line in the partner ledger.
        if not self:
            raise UserError(_("The Customer Statements cannot be printed without a partner set."))
        partner_lines = defaultdict(list)
        partner_running_balances = defaultdict(float)
        # 0. If we do not have a from and to date, we will default to the current month.
        yesterday = fields.Date.today() - relativedelta(days=1)
        if options:
            from_date = options.get("date", {}).get("date_from") or yesterday.replace(day=1)
            to_date = options.get("date", {}).get("date_to") or yesterday
            unreconciled = options.get("unreconciled", False)
            report = self.env['account.report'].browse(options.get('report_id'))
        else:
            from_date = yesterday.replace(day=1)
            to_date = yesterday
            unreconciled = False
            report = self.env.ref('account_reports.partner_ledger_report')
        # Also prepare report options, as we will use the report sql code to get the line values.
        options = report.get_options(
            previous_options={
                'date': {
                    'date_from': from_date,
                    'date_to': to_date,
                    'mode': 'range',
                },
                'account_type': [
                    {'id': 'trade_receivable', 'selected': True},
                    {'id': 'non_trade_receivable', 'selected': False},
                    {'id': 'trade_payable', 'selected': False},
                    {'id': 'non_trade_payable', 'selected': False},
                ],
                'unreconciled': unreconciled,
                'multi_currency': True,
            }
        )
        # 1. Get the initial balance using the partner ledger.
        initial_balances = self._get_initial_balances(options, report)
        # 2. Get the other lines
        line_values = self._get_aml_values(options, report)

        # Make the lines
        for partner in self:
            # Always show the initial balance, even if 0, as no balance is also an information.
            partner_running_balances[partner.id] = initial_balances[partner.id]
            partner_lines[partner.id].append(
                {
                    'date': format_date(self.env, from_date, date_format='d MMM yy'),
                    'activity': 'Initial Balance',
                    'reference': '',
                    'due_date': '',
                    'amount': '',
                    'move_type': '',
                    'balance': format_monetary(initial_balances[partner.id]),
                }
            )
            partner_line_values = line_values.get(partner.id, [])
            for line_value in partner_line_values:
                partner_running_balances[partner.id] += line_value.get('balance', 0.0)
                is_payment = line_value.get('move_type') == 'entry' and line_value.get('payment_id')
                due_date = '' if is_payment else format_date(self.env, line_value.get('date_maturity'), date_format='d MMM yy')
                partner_lines[partner.id].append(
                    {
                        'date': format_date(self.env, line_value.get('invoice_date'), date_format='d MMM yy'),
                        'activity': line_value.get('move_name'),
                        'reference': line_value.get('ref'),
                        'due_date': due_date,
                        'amount': format_monetary(line_value.get('balance', 0.0)),
                        'move_type': self._get_move_type(line_value),
                        'balance': format_monetary(partner_running_balances[partner.id]),
                    }
                )
        return {
                'from_date': format_date(self.env, from_date, date_format='d MMMM yyyy'),
                'to_date': format_date(self.env, to_date, date_format='d MMMM yyyy'),
                'lines': partner_lines,
                'balances_due': {
                    partner.id: format_monetary(partner_running_balances[partner.id]) for partner in self
                },
            }

    def _get_initial_balances(self, options, report):
        balances = self.env[report.custom_handler_model_name]._get_initial_balance_values(
            self.ids,
            options=options,
        )
        return {partner.id: next(iter(balances[partner.id].values())).get('balance', 0.0) for partner in self}

    def _get_aml_values(self, options, report):
        aml_values = self.env[report.custom_handler_model_name]._get_aml_values(
            options=options,
            partner_ids=self.ids,
        )
        return {partner.id: aml_values.get(partner.id, []) for partner in self}

    def _get_move_type(self, line_value):
        type_name_mapping = dict(
            self.env['account.move']._fields['move_type']._description_selection(self.env),
            out_invoice=_('Invoice'),
            out_refund=_('Credit Note'),
        )
        is_payment = line_value.get('move_type') == 'entry' and line_value.get('payment_id')
        move_type = type_name_mapping.get(line_value.get('move_type'), '')
        if is_payment:
            move_type = f"{'⬅' if line_value.get('balance', 0.0) < 0 else '➡'}{_('Payment')}"
        return move_type

    def _get_customer_statement_pdf(self):
        """
        Return the pdf of the customer statement report.
        """
        self.ensure_one()
        pdf_file, dummy = self.env['ir.actions.report']._render_qweb_pdf(
            self.env.ref('l10n_account_customer_statements.action_customer_statements_report').id,
            res_ids=self.ids,
        )
        return self.env['ir.attachment'].create({
            'name': _("Customer Statement %s.pdf", self.name) if self.name else _("Customer Statement.pdf"),
            'raw': pdf_file,
            'res_model': self._name,
            'res_id': self.id,
        })

    def _cron_send_customer_statements(self):
        partners = self.search([
            ('automatic_customer_statement_enabled', '=', True),
            ('next_customer_statement_date', '<=', fields.Date.today()),
        ])
        yesterday = fields.Date.today() - relativedelta(days=1)
        from_date = yesterday.replace(day=1)
        to_date = yesterday
        for partner in partners:
            doc_ids = partner._get_customer_statement_pdf()
            template = self.env.ref(
                'l10n_account_customer_statements.email_template_customer_statement',
            )
            partner._ensure_customer_statement_token()
            # Pass the dates in the context for the mail template.
            partner.with_context(
                from_date=format_date(self.env, from_date, date_format='d MMMM yyyy'),
                to_date=format_date(self.env, to_date, date_format='d MMMM yyyy'),
            ).message_post_with_source(
                source_ref=template,
                attachment_ids=doc_ids,
            )
        partners._update_next_customer_statement_date()
