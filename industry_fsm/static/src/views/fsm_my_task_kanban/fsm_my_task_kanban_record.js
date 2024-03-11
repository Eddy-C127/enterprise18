import { ProjectTaskKanbanRecord } from "@project/views/project_task_kanban/project_task_kanban_record";
import { CANCEL_GLOBAL_CLICK } from "@web/views/kanban/kanban_record";

export class FsmMyTaskKanbanRecord extends ProjectTaskKanbanRecord {
    onGlobalClick(ev) {
        if (!this.env.isSmall) {
            super.onGlobalClick(ev);
            return;
        }
        if (!ev.target.closest(CANCEL_GLOBAL_CLICK)) {
            const { record } = this.props;
            this.action.doActionButton({
                name: "action_fsm_task_mobile_view",
                type: "object",
                resModel: record.resModel,
                resId: record.resId,
                context: record.context,
                onClose: async () => {
                    await record.model.root.load();
                },
            });
        }
    }
}
