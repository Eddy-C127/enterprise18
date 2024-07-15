import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { MapModel } from "@web_map/map_view/map_model";
import { projectConflictTasksModel } from "../project_conflicted_tasks";

export class ProjectTaskMapModel extends MapModel {
    /**
     * @override
     */
    _getEmptyGroupLabel(fieldName) {
        if (fieldName === "project_id") {
            return _t("Private");
        } else if (fieldName === "user_ids") {
            return _t("Unassigned");
        } else {
            return super._getEmptyGroupLabel(fieldName);
        }
    }
}

patch(
    ProjectTaskMapModel.prototype,
    projectConflictTasksModel((model) => model.metaData.resModel)
);
