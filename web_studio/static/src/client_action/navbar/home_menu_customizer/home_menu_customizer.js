/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { rpc } from "@web/core/network/rpc";
import { user } from "@web/core/user";
import { useService } from "@web/core/utils/hooks";
import { browser } from "@web/core/browser/browser";
import { download } from "@web/core/network/download";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { FileInput } from "@web/core/file_input/file_input";

import { Component } from "@odoo/owl";

export class HomeMenuCustomizer extends Component {
    static template = "web_studio.HomeMenuCustomizer";
    static props = {};
    static components = { Dropdown, DropdownItem, FileInput };

    setup() {
        this.ui = useService("ui");
        this.notification = useService("notification");
        this.company = useService("company");
        this.actionManager = useService("action");
        this.menus = useService("menu");
        this.dialogManager = useService("dialog");
    }

    setBackgroundImage(attachment_id) {
        return rpc("/web_studio/set_background_image", {
            attachment_id: attachment_id,
            context: user.context,
        });
    }
    /**
     * Export all customizations done by Studio in a zip file containing Odoo
     * modules.
     */
    exportCusto() {
        download({ url: "/web_studio/export", data: {} });
    }
    /**
     * Open a dialog allowing to import new modules
     * (e.g. exported customizations).
     */
    importCusto() {
        const action = {
            name: "Import modules",
            res_model: "base.import.module",
            views: [[false, "form"]],
            type: "ir.actions.act_window",
            target: "new",
            context: {
                dialog_size: "medium",
            },
        };
        const options = {
            onClose: () => this.menus.reload(),
        };
        this.actionManager.doAction(action, options);
    }

    async confirmReset() {
        this.ui.block();
        try {
            await rpc("/web_studio/reset_background_image", {
                context: user.context,
            });
            browser.location.reload();
        } finally {
            this.ui.unblock();
        }
    }

    resetBackground() {
        this.dialogManager.add(ConfirmationDialog, {
            body: _t("Are you sure you want to reset the background image?"),
            title: _t("Confirmation"),
            confirm: () => this.confirmReset(),
        });
    }

    async onBackgroundUpload([file]) {
        if (!file) {
            this.notification.add(_t("Could not change the background"), {
                sticky: true,
                type: "warning",
            });
        } else {
            this.ui.block();
            try {
                await this.setBackgroundImage(file.id);
                browser.location.reload();
            } finally {
                this.ui.unblock();
            }
        }
    }
}
