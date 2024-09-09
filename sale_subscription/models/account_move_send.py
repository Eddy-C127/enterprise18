from odoo import models


class AccountMoveSend(models.AbstractModel):
    _inherit = 'account.move.send'

    def _get_default_mail_template_id(self, move):
        # EXTENDS 'account'
        if move.invoice_line_ids.subscription_id:
            return self.env.ref('sale_subscription.email_payment_success')
        else:
            return super()._get_default_mail_template_id(move)
