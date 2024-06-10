import { registry } from "@web/core/registry";

function _mockWebGanttWrite(_, args) {
    return this.mockWrite(args.model, args.args);
}

registry.category("mock_server").add("web_gantt_write", _mockWebGanttWrite);
