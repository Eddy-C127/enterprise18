# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class IrUiMenu(models.Model):
    _inherit = 'ir.ui.menu'

    def _visible_menu_ids(self, debug=False):
        visible_ids = super()._visible_menu_ids(debug)
        # These menus should only be visible to users with group_account_readonly and group_no_one
        # We want to avoid moving these menus to the new `accountant` module
        if not self.env.user.has_group('account.group_account_readonly'):
            accounting_menus = [
                'account_accountant.account_tag_menu',
                'account_accountant.menu_account_group',
            ]
            hidden_menu_ids = {self.env.ref(r).sudo().id for r in accounting_menus if self.env.ref(r, raise_if_not_found=False)}
            return visible_ids - hidden_menu_ids
        return visible_ids
