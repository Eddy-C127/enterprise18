/** @odoo-module **/
import { patch } from "@web/core/utils/patch";

import { PermissionPanel } from "@knowledge/components/permission_panel/permission_panel";
import { CopyClipboardCharField } from "@web/views/fields/copy_clipboard/copy_clipboard_field";

const PermissionPanelWebsiteKnowledgePatch = {
    toggleWebsitePublished() {
        if (this.props.record.data.user_can_write) {
            this.props.record.update({website_published: !this.props.record.data.website_published});
            this.props.record.save();
        }
    }
};

patch(PermissionPanel.prototype, 'website_knowledge_patch', PermissionPanelWebsiteKnowledgePatch);
PermissionPanel.components = {
    ...PermissionPanel.components,
    CopyClipboardCharField,
};
