/** @odoo-module **/

import { Component } from "@odoo/owl";

export class Box extends Component {
    static template = "account_invoice_extract.Box";
    static props = {
        box: Object,
        pageWidth: String,
        pageHeight: String,
        onClickBoxCallback: Function,
    };
    /**
     * @override
     */
    setup() {
        this.state = this.props.box;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    get style() {
        return 'left: ' + (this.state.box_midX * parseInt(this.props.pageWidth)) + 'px; ' +
               'top: ' + (this.state.box_midY * parseInt(this.props.pageHeight)) + 'px; ' +
               'width: ' + (this.state.box_width * parseInt(this.props.pageWidth)) + 'px; ' +
               'height: ' + (this.state.box_height * parseInt(this.props.pageHeight)) + 'px; ' +
               'transform: translate(-50%, -50%) rotate(' + this.state.box_angle + 'deg); ' +
               '-ms-transform: translate(-50%, -50%) rotate(' + this.state.box_angle + 'deg); ' +
               '-webkit-transform: translate(-50%, -50%) rotate(' + this.state.box_angle + 'deg);';
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    onClick() {
        this.props.onClickBoxCallback(this.state.id, this.state.page);
    }
};
