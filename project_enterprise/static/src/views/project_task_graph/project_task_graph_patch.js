import { ProjectTaskGraphModel } from "@project/views/project_task_graph/project_task_graph_model";
import { patch } from "@web/core/utils/patch";
import { projectConflictTasksModel } from "../../project_conflicted_tasks";

patch(
    ProjectTaskGraphModel.prototype,
    projectConflictTasksModel((model) => model.metaData.resModel)
);
