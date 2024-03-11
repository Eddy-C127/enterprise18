import { ProjectTaskListController } from "@project/views/project_task_list/project_task_list_controller";

export class FsmMyTaskListController extends ProjectTaskListController {
    async openRecord(record) {
        if (!this.env.isSmall) {
            super.openRecord(record);
            return;
        }
        await record.save();
        this.actionService.doActionButton({
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
