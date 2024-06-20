import { KanbanRecordQuickCreate, KanbanQuickCreateController } from "@web/views/kanban/kanban_record_quick_create";

export class BankRecQuickCreateController extends KanbanQuickCreateController {
    static template = "account.BankRecQuickCreateController";
}

export class BankRecQuickCreate extends KanbanRecordQuickCreate {
    static template = "account.BankRecQuickCreate";
    static props = {
        ...Object.entries(KanbanRecordQuickCreate.props).filter(([k, v]) => k !== 'group'),
        quickCreateView: { type: [String, { value: null }], optional: 1 },
    };
    static components = { BankRecQuickCreateController };

    /**
    Overriden.
    **/
    async getQuickCreateProps(props) {
        await super.getQuickCreateProps({...props,
            group: {
                resModel: props.globalState.quickCreateState.resModel,
                context: props.globalState.quickCreateState.context,
            }
        });
    }
}
