from odoo import models, fields, api


class AccountPaymentRegister(models.TransientModel):
    _inherit = 'account.payment.register'

    sdd_mandate_usable = fields.Boolean(string="Could a SDD mandate be used?",
        compute='_compute_usable_mandate')

    @api.depends('payment_date', 'partner_id', 'company_id')
    def _compute_usable_mandate(self):
        """ returns the first mandate found that can be used for this payment,
        or none if there is no such mandate.
        """
        for wizard in self:
            wizard.sdd_mandate_usable = bool(wizard.env['sdd.mandate']._sdd_get_usable_mandate(
                company_id=wizard.company_id.id or wizard.env.company.id,
                partner_id=wizard.partner_id.commercial_partner_id.id,
                date=wizard.payment_date,
            ))
