import { ProjectTaskCalendarController } from "@project/views/project_task_calendar/project_task_calendar_controller";

export class FsmMyTaskCalendarController extends ProjectTaskCalendarController {
    async editRecord(record, context = {}, shouldFetchFormViewId = true) {
        if (this.env.isSmall) {
            return this.action.doActionButton({
                name: "action_fsm_task_mobile_view",
                type: "object",
                resModel: this.model.resModel,
                resId: record.id || false,
                context,
                onClose: async () => {
                    await this.model.load();
                },
            });
        }
        return super.editRecord(record, context, shouldFetchFormViewId);
    }
}
