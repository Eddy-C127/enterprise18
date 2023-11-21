/** @odoo-module **/

import { AccountMoveLineListController, AccountMoveLineListView } from "@account_accountant/components/move_line_list/move_line_list"
import { registry } from "@web/core/registry";

class ConsolidationMoveLineListController extends AccountMoveLineListController {
    static template = "account_consolidation.MoveLineListView";
    setup() {
        super.setup();
        this.context = this.props.context;
    }
}

const ConsolidationMoveLineListView = {
    ...AccountMoveLineListView,
    Controller: ConsolidationMoveLineListController,
};

registry.category("views").add('consolidation_move_line_list', ConsolidationMoveLineListView);
