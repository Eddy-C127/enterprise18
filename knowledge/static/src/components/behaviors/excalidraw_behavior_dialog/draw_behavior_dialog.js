/** @odoo-module */

import { Dialog } from "@web/core/dialog/dialog";
import { useAutofocus } from "@web/core/utils/hooks";

import { checkURL, excalidrawWebsiteDomainList } from "@knowledge/js/knowledge_utils";

import { Component, useExternalListener, useState } from "@odoo/owl";

/**
 * This is the dialog where the link is inputted by the user to populate the
 * behavior.
 */
export class DrawBehaviorDialog extends Component {
    static template = "knowledge.DrawBehaviorDialog";
    static props = {
        close: Function,
        saveLink: Function,
    };
    static components = { Dialog };

    setup() {
        super.setup();
        this.state = useState({});
        this.inputRef = useAutofocus({ refName: "urlInput" });
        useExternalListener(window, "keydown", this.onKeyDown.bind(this));
    }

    onKeyDown(event) {
        this.state.isError = false;
        if (event.key === "Enter") {
            this.saveURL();
        }
    }

    checkInput() {
        let potentialURL = this.inputRef.el.value;
        if (!potentialURL) {
            return false;
        }
        potentialURL = checkURL(potentialURL, excalidrawWebsiteDomainList);
        if (!potentialURL) {
            this.state.isError = true;
        } else {
            return potentialURL;
        }
    }

    saveURL() {
        const potentialURL = this.checkInput();
        if (potentialURL) {
            this.props.saveLink(potentialURL);
            this.props.close();
        }
    }
}
