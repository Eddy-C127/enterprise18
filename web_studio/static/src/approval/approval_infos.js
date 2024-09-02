/** @odoo-module */

import { formatDate, deserializeDate } from "@web/core/l10n/dates";
import { Dialog } from "@web/core/dialog/dialog";
import { user } from "@web/core/user";

import { useState, Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class StudioApprovalInfos extends Component {
    static template = "StudioApprovalInfos";
    static components = { Dialog };
    static props = {
        isPopover: Boolean,
        approval: Object,
        close: { type: Function, optional: true },
    };

    setup() {
        this.user = user;
        const approval = this.props.approval;
        this.approval = approval;
        this.state = useState(approval.state);
        this.actionService = useService("action");
    }

    formatDate(val, format) {
        return formatDate(deserializeDate(val), { format });
    }

    getEntry(ruleId) {
        return this.state.entries.find((e) => e.rule_id[0] === ruleId);
    }

    setApproval(ruleId, approved) {
        return this.approval.setApproval(ruleId, approved);
    }

    cancelApproval(ruleId) {
        return this.approval.cancelApproval(ruleId);
    }

    openKanbanApprovalRules() {
        const { resModel, method, action } = this.approval;
        return this.actionService.doActionButton({
            type: "object",
            name: "open_kanban_rules",
            resModel: "studio.approval.rule",
            resIds: [],
            args: JSON.stringify([resModel, method, action]),
        });
    }
}
