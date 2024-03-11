import { MapController } from "@web_map/map_view/map_controller";

export class FsmMyTaskMapController extends MapController {
    openRecords(ids) {
        if (ids.length === 1 && this.env.isSmall) {
            return this.action.doActionButton({
                name: "action_fsm_task_mobile_view",
                type: "object",
                resModel: this.props.resModel,
                resId: ids[0],
            });
        }
        super.openRecords(ids);
    }
}
