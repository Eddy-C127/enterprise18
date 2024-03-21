import { Component, useState, useRef } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { _t } from "@web/core/l10n/translation";

export const VIEW_LINK_BEHAVIOR_STYLES = {
    link: { display: _t("Link"), class: "btn-link text-o-color-1" },
    primary: { display: _t("Primary"), class: "btn btn-primary text-truncate mw-100" },
    secondary: { display: _t("Secondary"), class: "btn btn-secondary text-truncate mw-100" },
};

export class ViewLinkBehaviorDialog extends Component {
    static template = "knowledge.view_link_behavior_dialog";
    static components = { Dialog };
    static props = {
        style: { type: String },
        close: { type: Function },
        name: { type: String },
        onSave: { type: Function },
    };
    setup() {
        super.setup();
        this.state = useState({
            name: this.props.name,
            style: this.props.style,
        });
        this.input = useRef("input");
        this.styles = VIEW_LINK_BEHAVIOR_STYLES;
    }

    //--------------------------------------------------------------------------
    // GETTERS/SETTERS
    //--------------------------------------------------------------------------

    get name() {
        return this.state.name.trim();
    }

    //--------------------------------------------------------------------------
    // HANDLERS
    //--------------------------------------------------------------------------

    inputUpdate(ev) {
        this.state.name = ev.target.value;
    }

    onConfirm() {
        if (!this.name) {
            return this.input.el.focus();
        }
        this.props.onSave(this.name, this.state.style);
        this.props.close();
    }

    updateStyle(style) {
        this.state.style = style;
    }
}
