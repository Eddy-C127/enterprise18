from odoo import models, fields


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    l10n_co_dian_software_id = fields.Char(
        string="Software ID",
        related="company_id.l10n_co_dian_software_id",
        readonly=False,
        help="Software identifier provided by the DIAN to invoice electronically with its own software.",
    )
    l10n_co_dian_software_security_code = fields.Char(
        string="Software PIN",
        related='company_id.l10n_co_dian_software_security_code',
        readonly=False,
        help="Software PIN created in the DIAN portal to invoice electronically with its own software.",
    )
    l10n_co_dian_certificate_ids = fields.One2many(
        string="Software Certificates",
        related='company_id.l10n_co_dian_certificate_ids',
        readonly=False,
        help="Certificates to be used for electronic invoicing.",
    )
    l10n_co_dian_test_environment = fields.Boolean(
        string="Test environment",
        related='company_id.l10n_co_dian_test_environment',
        readonly=False,
        help="Activate this checkbox if you’re testing workflows for electronic invoicing.",
    )
    l10n_co_dian_certification_process = fields.Boolean(
        string="Activate the certification process",
        related='company_id.l10n_co_dian_certification_process',
        readonly=False,
        help="Activate this checkbox if you are in the certification process with the DIAN.",
    )
    l10n_co_dian_testing_id = fields.Char(
        string="Testing ID",
        related='company_id.l10n_co_dian_testing_id',
        readonly=False,
        help="Testing ID is needed for the certification process with the DIAN and for general testing of "
             "electronic invoicing workflows.",
    )
    l10n_co_dian_provider = fields.Selection(
        string="Electronic Invoicing Provider",
        related='company_id.l10n_co_dian_provider',
        readonly=False,
        required=True,
    )
