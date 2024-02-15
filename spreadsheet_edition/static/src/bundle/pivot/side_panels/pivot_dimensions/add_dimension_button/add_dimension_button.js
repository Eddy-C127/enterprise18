import { fuzzyLookup } from "@web/core/utils/search";

import { Component, useExternalListener, useRef, useState } from "@odoo/owl";
import { components } from "@odoo/o-spreadsheet";

const { Popover } = components;

export class AddDimensionButton extends Component {
    static template = "spreadsheet_edition.AddDimensionButton";
    static components = { Popover };
    static props = {
        onFieldPicked: Function,
        fields: Array,
    };

    // TODO navigation keys. (this looks a lot like auto-complete list. Could maybe be factorized)
    setup() {
        useExternalListener(window, "click", (ev) => {
            if (ev.target !== this.buttonRef.el) {
                this.popover.isOpen = false;
            }
        });
        this.buttonRef = useRef("button");
        this.popover = useState({ isOpen: false });
        this.search = useState({ input: "" });
    }

    get filteredFields() {
        if (this.search.input) {
            return fuzzyLookup(this.search.input, this.props.fields, (field) => field.string);
        }
        return this.props.fields;
    }

    get popoverProps() {
        return {
            anchorRect: this.buttonRef.el.getBoundingClientRect(),
            positioning: "BottomLeft",
        };
    }

    pickField(field) {
        this.props.onFieldPicked(field.name);
        this.popover.isOpen = false;
        this.search.input = "";
    }

    togglePopover() {
        this.popover.isOpen = !this.popover.isOpen;
        this.search.input = "";
    }

    onKeyDown(ev) {
        if (this.filteredFields.length === 1 && ev.key === "Enter") {
            this.pickField(this.filteredFields[0]);
        }
    }
}
