import { ActivityController } from "@mail/views/web/activity/activity_controller";

export class FsmMyTaskActivityController extends ActivityController {
    openRecord(record, mode) {
        if (this.env.isSmall) {
            return this.action.doActionButton({
                name: "action_fsm_task_mobile_view",
                type: "object",
                resModel: record.resModel,
                resId: record.resId,
                context: record.context,
            });
        }
        return super.openRecord(record, mode);
    }
}
