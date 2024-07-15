import { TaskGanttRenderer } from "@project_enterprise/views/task_gantt/task_gantt_renderer";

export class FsmTaskGanttRenderer extends TaskGanttRenderer {
    getSelectCreateDialogProps(params) {
        const props = super.getSelectCreateDialogProps(params);
        if (this.env.isSmall) {
            props.onCreateEdit = () => {
                this.actionService.doActionButton({
                    name: "action_fsm_task_mobile_view",
                    type: "object",
                    resModel: this.model.metaData.resModel,
                    resId: false,
                    context: props.context,
                });
            };
        }
        return props;
    }

    getPopoverProps(pill) {
        const props = super.getPopoverProps(pill);
        if (this.env.isSmall) {
            props.button.onClick = () => {
                this.actionService.doActionButton({
                    name: "action_fsm_task_mobile_view",
                    type: "object",
                    resModel: this.model.metaData.resModel,
                    resId: pill.record.id,
                });
            };
        }
        return props;
    }
}
