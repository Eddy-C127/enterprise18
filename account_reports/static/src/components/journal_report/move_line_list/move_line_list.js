/** @odoo-module **/

import { registry } from "@web/core/registry";
import { AccountMoveLineListRenderer, AccountMoveLineListView } from "@account_accountant/components/move_line_list/move_line_list";


export class JournalReportAccountMoveLineReconcileListRenderer extends AccountMoveLineListRenderer {
    setup() {
        super.setup();
        for (const group of this.props.list.groups) {
            for (const innerGroup of group.list?.groups) {
                this.toggleGroup(innerGroup);
            }
        }
    }
}

export const JournalReportAccountMoveLineReconcileLineListView = {
    ...AccountMoveLineListView,
    Renderer: JournalReportAccountMoveLineReconcileListRenderer,
};

registry.category("views").add("account_move_line_journal_report_list", JournalReportAccountMoveLineReconcileLineListView);
