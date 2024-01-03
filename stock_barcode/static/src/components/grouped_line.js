/** @odoo-module **/

import LineComponent from "@stock_barcode/components/line";

export default class GroupedLineComponent extends LineComponent {
    static components = { LineComponent };
    static template = "stock_barcode.GroupedLineComponent";

    get isSelected() {
        return this.line.virtual_ids.indexOf(this.env.model.selectedLineVirtualId) !== -1;
    }

    get opened() {
        return this.env.model.groupKey(this.line) === this.env.model.unfoldLineKey;
    }

    get sublineProps() {
        return {
            displayUOM: this.props.displayUOM,
            editLine: this.props.editLine,
            line: this.subline,
            subline: true,
        };
    }

    toggleSublines(ev) {
        ev.stopPropagation();
        this.env.model.toggleSublines(this.line);
    }
}
