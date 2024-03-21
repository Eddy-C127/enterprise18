import { Component } from "@odoo/owl";

export class ViewLinkBehaviorPopover extends Component {
    static template = "knowledge.ViewLinkPopover";
    static props = {
        close: { type: Function },
        name: { type: String },
        onCopyLinkClick: { type: Function },
        onEditLinkClick: { type: Function },
        onRemoveLinkClick: { type: Function },
        openViewLink: { type: Function },
    };
}
