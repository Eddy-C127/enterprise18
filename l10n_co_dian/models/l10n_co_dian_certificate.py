from cryptography.hazmat.primitives import serialization
from importlib import metadata

import pytz

from odoo import models, fields, api, _
from odoo.fields import datetime
from odoo.exceptions import ValidationError, UserError
from odoo.addons.l10n_co_dian import xml_utils
from odoo.tools import parse_version


class Certificate(models.Model):
    _name = 'l10n_co_dian.certificate'
    _description = "DIAN Digital Certificate"

    certificate = fields.Binary(help="Certificate in PEM format", required=True)
    key = fields.Binary(string="Certificate Key", help="Certificate Key in PEM format", required=True)
    company_id = fields.Many2one(
        comodel_name='res.company',
        string="Company",
        required=True,
        default=lambda self: self.env.company,
        ondelete='cascade',
    )
    serial_number = fields.Char(string="Serial number", compute='_compute_certificate_data')
    date_start = fields.Datetime(string="Available date", compute='_compute_certificate_data')
    date_end = fields.Datetime(string="Expiration date", compute='_compute_certificate_data')

    @api.constrains('certificate', 'key')
    def _check_certificate(self):
        for cert in self:
            cert_vals = cert._decode_certificate()
            try:
                key = xml_utils._decode_private_key(self)
            except ValueError as e:
                raise ValidationError(_("Invalid certificate key:\n%(error)s", error=str(e)))
            if key.public_key().public_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ) != cert_vals['public_key']:
                raise ValidationError(_("The key and certificate do not match."))

    @api.depends('certificate')
    def _compute_certificate_data(self):
        for cert in self:
            if cert.certificate:
                cert_vals = cert._decode_certificate()
                cert.serial_number = cert_vals['serial_number']
                cert.date_start = cert_vals['not_valid_before']
                cert.date_end = cert_vals['not_valid_after']
            else:
                cert.serial_number, cert.date_start, cert.date_end = False, False, False

    def _decode_certificate(self):
        self.ensure_one()
        try:
            certificate = xml_utils._decode_certificate(self)
        except ValueError as e:
            raise ValidationError(_("Invalid certificate:\n%(error)s", error=str(e)))
        else:
            if parse_version(metadata.version('cryptography')) < parse_version('42.0.0'):
                not_valid_after = certificate.not_valid_after
                not_valid_before = certificate.not_valid_before
            else:
                not_valid_after = certificate.not_valid_after_utc.replace(tzinfo=None)
                not_valid_before = certificate.not_valid_before_utc.replace(tzinfo=None)
            return {
                'public_key': certificate.public_key().public_bytes(
                    encoding=serialization.Encoding.DER,
                    format=serialization.PublicFormat.SubjectPublicKeyInfo
                ),
                'serial_number': certificate.serial_number,
                'not_valid_before': not_valid_before,
                'not_valid_after': not_valid_after,
            }

    def _is_valid(self):
        self.ensure_one()
        return self.date_start <= datetime.utcnow() <= self.date_end

    def _get_certificate_chain(self):
        """ Returns the certificates ordered by expiration date """
        if not self:
            raise UserError(_("No certificate found for the current company."))
        certifs = self.sorted('date_end')
        if not certifs[-1]._is_valid():
            raise UserError(_("No valid certificate found. Check their availability/expiration dates."))
        return certifs

    @staticmethod
    def _convert_to_naive_utc_datetime(naive_co_datetime):
        """ Convert a naive Colombian datetime to a naive UTC datetime """
        return pytz.timezone('America/Bogota').localize(naive_co_datetime).astimezone(pytz.utc).replace(tzinfo=None)
