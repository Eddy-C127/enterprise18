from odoo import _, api, fields, models

class SpreadsheetCellThread(models.Model):
    _name = "spreadsheet.cell.thread"

    _description = "Spreadsheet discussion thread"

    _inherit = ["mail.thread"]

    display_name = fields.Char(compute="_compute_display_name", compute_sudo=True)

    def _compute_display_name(self):
        for record in self:
            record.display_name = self._get_spreadsheet_record().display_name

    @api.model_create_multi
    def create(self, vals_list):
        return super(
            SpreadsheetCellThread, self.with_context(mail_create_nolog=True)
        ).create(vals_list)


    def _notify_thread_by_email(self, message, recipients_data, **kwargs):
        """ We need to override this method to set our own mail template to be sent to users that
        have been tagged inside a comment. We are using the template 'documents_spreadsheet.mail_notification_layout'
        which is a simple template comprised of the comment sent and the person that tagged the notified user.
        """

        kwargs["msg_vals"] = {
            **kwargs["msg_vals"],
            "email_layout_xmlid": "spreadsheet_edition.mail_notification_layout",
        }
        return super()._notify_thread_by_email(message, recipients_data, **kwargs)

    def _message_compute_subject(self):
        self.ensure_one()
        return _("New Mention in %s") % self.display_name

    def get_spreadsheet_access_action(self):
        related_record = self._get_spreadsheet_record()
        if related_record and related_record.check_access_rights("read", raise_exception=False):
            action = related_record.action_edit()
            action["params"] = action.get("params", {})
            action["params"]["thread_id"] = self.id
            return action
        else:
            return {
                "type": "ir.actions.client",
                "tag": "home",
            }

    def _get_access_action(self, access_uid=None, force_website=False):
        self.ensure_one()

        related_record = self._get_spreadsheet_record()
        if related_record:
            # client actions are not supported atm, so we rely on act_url
            url = "/web/?action=%s&spreadsheet_id=%s&thread_id=%s" % (
                related_record.action_edit().get("tag"),
                related_record.id,
                self.id,
            )

            action = {
                "type": "ir.actions.act_url",
                "url": url,
                # required to avoid being redirected to the cell thread model view
                "target_type": "public",
            }
            return action

        return super()._get_access_action(access_uid=access_uid, force_website=force_website)

    def _get_spreadsheet_record(self):
        return False

    def check_access_rights(self, operation, raise_exception=True):
        if self.env.su:
            return
        record = self.sudo()._get_spreadsheet_record()  # stop looping on fetch of field
        return record and record.with_user(self.env.user).check_access_rights(operation, raise_exception)\
            and super().check_access_rights(operation, raise_exception)
