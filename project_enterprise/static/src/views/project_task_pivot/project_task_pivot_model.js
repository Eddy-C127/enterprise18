import { ProjectTaskPivotModel } from "@project/views/project_task_pivot/project_pivot_model";
import { patch } from "@web/core/utils/patch";
import { projectConflictTasksModel } from "../../project_conflicted_tasks";

patch(
    ProjectTaskPivotModel.prototype,
    projectConflictTasksModel((model) => model.metaData.resModel)
);
