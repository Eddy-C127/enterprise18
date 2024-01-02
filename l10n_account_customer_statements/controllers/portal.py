from odoo import http, _
from odoo.http import request
from odoo.addons.portal.controllers.portal import CustomerPortal
from odoo.exceptions import AccessError, MissingError


class UnsubscribeCustomerStatementPortal(CustomerPortal):

    @http.route(['/customer_statements/unsubscribe/<int:partner_id>'], type='http', auth="public", website=True, sitemap=False)
    def portal_unsubscribe_customer_statment(self, partner_id, access_token=None, **kw):
        try:
            partner_sudo = self._document_check_access('res.partner', partner_id, access_token)
        except (AccessError, MissingError):
            return request.redirect('/my')
        if partner_sudo.automatic_customer_statement_enabled:
            partner_sudo.automatic_customer_statement_enabled = False
            partner_sudo.message_post(body=_('%(partner_name)s has unsubscribed from customer statements.', partner_name=partner_sudo.name))
        return request.render("l10n_account_customer_statements.portal_unsubscribe_customer_statement")
