import { Component } from "@odoo/owl";

export class GanttPopover extends Component {
    static template = "web_gantt.GanttPopover";
    static props = ["title", "template?", "context", "close", "button?"];
    static defaultProps = { template: "web_gantt.GanttPopover.default" };
    onClick() {
        this.props.button.onClick();
        this.props.close();
    }
}
