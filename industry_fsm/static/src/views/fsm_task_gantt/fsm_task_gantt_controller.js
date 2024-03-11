import { TaskGanttController } from "@project_enterprise/task_gantt_controller";

export class FsmTaskGanttController extends TaskGanttController {
    create(context) {
        if (this.env.isSmall) {
            this.actionService.doActionButton({
                name: "action_fsm_task_mobile_view",
                type: "object",
                resModel: this.model.metaData.resModel,
                resId: false,
                context: context,
            });
            return;
        }
        super.create(context);
    }
}
