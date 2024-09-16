from odoo import api, models, _


class SpreadsheetDashboard(models.Model):
    _name = 'spreadsheet.dashboard'
    _inherit = ['spreadsheet.dashboard', 'spreadsheet.mixin']

    def join_spreadsheet_session(self, *args, **kwargs):
        return dict(
            super().join_spreadsheet_session(*args, **kwargs),
            is_published=self.is_published
        )

    def action_edit_dashboard(self):
        self.ensure_one()
        return {
            "type": "ir.actions.client",
            "tag": "action_edit_dashboard",
            "params": {
                "spreadsheet_id": self.id,
            },
        }

    def get_readonly_dashboard(self):
        self.ensure_one()
        data = self.join_spreadsheet_session()
        snapshot = data["data"]
        revisions = data["revisions"]
        update_locale_command = {
            "type": "UPDATE_LOCALE",
            "locale": self.env["res.lang"]._get_user_spreadsheet_locale(),
        }
        revisions.append(self._build_new_revision_data(update_locale_command))
        return {
            "snapshot": snapshot,
            "revisions": revisions,
            "default_currency": data["default_currency"],
        }

    def action_open_spreadsheet(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.client',
            'tag': 'action_edit_dashboard',
            'params': {
                'spreadsheet_id': self.id,
            }
        }

    def _creation_msg(self):
        return _("New dashboard created")

    @api.model
    def _get_spreadsheet_selector(self):
        return {
            "model": self._name,
            "display_name": _("Dashboards"),
            "sequence": 10,
            "allow_create": False,
        }
