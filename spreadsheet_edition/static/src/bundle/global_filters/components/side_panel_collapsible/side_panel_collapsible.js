/** @odoo-module */

import { Component, useRef, onMounted } from "@odoo/owl";

export class SidePanelCollapsible extends Component {
    static template = "spreadsheet_edition.SidePanelCollapsible";
    static props = {
        slots: Object,
        collapsedAtInit: { type: Boolean, optional: true },
    };

    setup() {
        const collapsibleRef = useRef("collapsible");
        const collapsibleButtonRef = useRef("collapsibleButton");
        onMounted(() => {
            if (!this.props.collapsedAtInit) {
                collapsibleRef.el.classList.add("show");
            }

            // Set aria-expanded at init to have the correct arrow icon rotation. It'll be managed by bootstrap afterwards.
            collapsibleButtonRef.el.setAttribute("aria-expanded", !this.props.collapsedAtInit);
        });
    }
}
