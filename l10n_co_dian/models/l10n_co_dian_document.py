from lxml import etree
from markupsafe import Markup

from base64 import b64encode
import io
import zipfile

from odoo import models, fields, api, _
from odoo.tools import html_escape
from odoo.addons.l10n_co_dian import xml_utils
from odoo.exceptions import UserError

TEST_ENDPOINT = "https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc?wsdl"
ENDPOINT = "https://vpfe.dian.gov.co/WcfDianCustomerServices.svc?wsdl"


class L10nCoDianDocument(models.Model):
    _name = 'l10n_co_dian.document'
    _description = "Colombian documents used for each interaction with the DIAN"
    _order = 'datetime DESC, id DESC'

    # Relational fields
    attachment_id = fields.Many2one(comodel_name='ir.attachment')
    move_id = fields.Many2one(comodel_name='account.move')

    # Business fields
    identifier = fields.Char(string="CUFE/CUDE/CUDS")
    zip_key = fields.Char(
        help="ID returned by the DIAN when sending a document with the certification process activated."
    )  # ID returned when calling SendTestSetAsync
    state = fields.Selection(selection=[
        ('invoice_sending_failed', "Sending Failed"),  # webservice is not reachable
        ('invoice_pending', "Pending"),  # document was sent and the response is not yet known
        ('invoice_rejected', "Rejected"),
        ('invoice_accepted', "Accepted"),
    ])
    message_json = fields.Json()
    message = fields.Html(compute="_compute_message")
    datetime = fields.Datetime()
    test_environment = fields.Boolean(help="Indicates whether the test endpoint was used to send this document")
    certification_process = fields.Boolean(
        help="Indicates whether we were in the certification process when sending this document",
    )

    # Buttons
    show_button_get_status = fields.Boolean(compute="_compute_show_button_get_status")

    @api.depends('zip_key', 'state', 'test_environment', 'certification_process')
    def _compute_show_button_get_status(self):
        for doc in self:
            doc.show_button_get_status = (
                doc.zip_key
                and doc.state not in ('invoice_accepted', 'invoice_rejected')
                and doc.test_environment
                and doc.certification_process
            )

    @api.depends('message_json')
    def _compute_message(self):
        for doc in self:
            msg = html_escape(doc.message_json.get('status', ""))
            if doc.message_json.get('errors'):
                msg += Markup("<ul>{errors}</ul>").format(
                    errors=Markup().join(
                        Markup("<li>%s</li>") % error for error in doc.message_json['errors']
                    ),
                )
            doc.message = msg

    def unlink(self):
        self.attachment_id.unlink()
        return super().unlink()

    @api.model
    def _parse_errors(self, root):
        """ Returns a list containing the errors/warnings from a DIAN response """
        return [node.text for node in root.findall(".//{*}ErrorMessage/{*}string")]

    @api.model
    def _build_message(self, root):
        msg = {'status': False, 'errors': []}
        fault = root.find('.//{*}Fault/{*}Reason/{*}Text')
        if fault is not None and fault.text:
            msg['status'] = fault.text + " (This might be caused by using incorrect certificates)"
        status = root.find('.//{*}StatusDescription')
        if status is not None and status.text:
            msg['status'] = status.text
        msg['errors'] = self._parse_errors(root)
        return msg

    @api.model
    def _create_document(self, xml, move, state, **kwargs):
        move.ensure_one()
        root = etree.fromstring(xml)
        # create document
        doc = self.create({
            'move_id': move.id,
            'identifier': root.find('.//{*}UUID').text,
            'state': state,
            # naive local colombian datetime
            'datetime': fields.datetime.fromisoformat(root.find('.//{*}SigningTime').text).replace(tzinfo=None),
            'test_environment': move.company_id.l10n_co_dian_test_environment,
            'certification_process': move.company_id.l10n_co_dian_certification_process,
            **kwargs,
        })
        # create attachment
        attachment = self.env['ir.attachment'].create({
            'raw': xml,
            'name': self.env['account.edi.xml.ubl_dian']._export_invoice_filename(move),
            'res_id': doc.id if state != 'invoice_accepted' else move.id,
            'res_model': doc._name if state != 'invoice_accepted' else move._name,
        })
        doc.attachment_id = attachment
        return doc

    @api.model
    def _send_test_set_async(self, zipped_content, move):
        """ Send the document to the 'SendTestSetAsync' (asynchronous) webservice.
        NB: later, need to fetch the result by calling the 'GetStatusZip' webservice.
        """
        response = xml_utils._build_and_send_request(
            self,
            payload={
                'file_name': "invoice.zip",
                'content_file': b64encode(zipped_content).decode(),
                'test_set_id': move.company_id.l10n_co_dian_testing_id,
                'soap_body_template': "l10n_co_dian.send_test_set_async",
            },
            service="SendTestSetAsync",
            company=move.company_id,
        )
        if not response['response']:
            return {
                'state': 'invoice_sending_failed',
                'message_json': {'status': _("The DIAN server did not respond.")},
            }
        root = etree.fromstring(response['response'])
        if response['status_code'] != 200:
            return {
                'state': 'invoice_sending_failed',
                'message_json': self._build_message(root),
            }
        zip_key = root.findtext('.//{*}ZipKey')
        if zip_key:
            return {
                'state': 'invoice_pending',
                'message_json': {'status': _("Invoice is being processed by the DIAN.")},
                'zip_key': zip_key,
            }
        return {
            'state': 'invoice_rejected',
            'message_json': {'errors': [node.text for node in root.findall('.//{*}ProcessedMessage')]},
        }

    @api.model
    def _send_bill_sync(self, zipped_content, move):
        """ Send the document to the 'SendBillSync' (synchronous) webservice. """
        response = xml_utils._build_and_send_request(
            self,
            payload={
                'file_name': "invoice.zip",
                'content_file': b64encode(zipped_content).decode(),
                'soap_body_template': "l10n_co_dian.send_bill_sync",
            },
            service="SendBillSync",
            company=move.company_id,
        )
        if not response['response']:
            return {
                'state': 'invoice_sending_failed',
                'message_json': {'status': _("The DIAN server did not respond.")},
            }
        root = etree.fromstring(response['response'])
        if response['status_code'] != 200:
            return {
                'state': 'invoice_sending_failed',
                'message_json': self._build_message(root),
            }
        return {
            'state': 'invoice_accepted' if root.findtext('.//{*}IsValid') == 'true' else 'invoice_rejected',
            'message_json': self._build_message(root),
        }

    def _get_status_zip(self):
        """ Fetch the status of a document sent to 'SendTestSetAsync' using the 'GetStatusZip' webservice. """
        self.ensure_one()
        response = xml_utils._build_and_send_request(
            self,
            payload={
                'track_id': self.zip_key,
                'soap_body_template': "l10n_co_dian.get_status_zip",
            },
            service="GetStatusZip",
            company=self.move_id.company_id,
        )
        if response['status_code'] == 200:
            root = etree.fromstring(response['response'])
            self.message_json = self._build_message(root)
            if root.findtext('.//{*}IsValid') == 'true':
                self.state = 'invoice_accepted'
            elif not root.findtext('.//{*}StatusCode'):
                self.state = 'invoice_pending'
            else:
                self.state = 'invoice_rejected'
        elif response['status_code']:
            raise UserError(_("The DIAN server returned an error (code %s)", response['status_code']))
        else:
            raise UserError(_("The DIAN server did not respond."))

    @api.model
    def _send_to_dian(self, xml, move):
        """ Send an xml to DIAN.
        If the Certification Process is activated, use the dedicated 'SendTestSetAsync' (asynchronous) webservice,
        otherwise, use the 'SendBillSync' (synchronous) webservice.

        :return: a l10n_co_dian.document
        """
        # Zip the xml
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED) as zipfile_obj:
            for att in [{'name': 'invoice.xml', 'content': xml}]:
                zipfile_obj.writestr(att['name'], att['content'])
        zipped_content = buffer.getvalue()

        if move.company_id.l10n_co_dian_test_environment and move.company_id.l10n_co_dian_certification_process:
            document_vals = self._send_test_set_async(zipped_content, move)
        else:
            document_vals = self._send_bill_sync(zipped_content, move)
        return self._create_document(xml, move, **document_vals)

    def action_get_status(self):
        for doc in self:
            doc._get_status_zip()

    def action_download_file(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_url',
            'url': f'/web/content/{self.attachment_id.id}?download=true',
        }
