import { Domain } from "@web/core/domain";
import { useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { ProjectTaskKanbanModel } from "@project/views/project_task_kanban/project_task_kanban_model";
import { ProjectTaskPivotModel } from "@project/views/project_task_pivot/project_pivot_model";
import { ProjectTaskGraphModel } from "@project/views/project_task_graph/project_task_graph_model";
import { ProjectEnterpriseTaskListModel } from "./views/project_task_tree/project_task_list_model";

export function useProjectModelActions({ getContext, resModel }) {
    const orm = useService("orm");
    return {
        async getHighlightIds() {
            const context = getContext();
            if (!context.highlight_conflicting_task) {
                return;
            }
            return await orm.search(resModel, [["planning_overlap", "!=", false]]);
        },
    };
}

export function projectConflictTasksModel(getResModel = (model) => model.config.resModel) {
    return {
        setup() {
            super.setup(...arguments);
            this.getHighlightIds = useProjectModelActions({
                getContext: () => this.env.searchModel._context,
                resModel: getResModel(this),
            }).getHighlightIds;
        },

        async load(params = {}) {
            const highlightIds = await this.getHighlightIds();
            if (highlightIds) {
                params.domain = Domain.and([params.domain, [["id", "in", highlightIds]]]).toList();
            }
            await super.load(...arguments);
        },
    };
}

patch(ProjectTaskKanbanModel.prototype, projectConflictTasksModel());
patch(
    ProjectTaskPivotModel.prototype,
    projectConflictTasksModel((model) => model.metaData.resModel)
);
patch(
    ProjectTaskGraphModel.prototype,
    projectConflictTasksModel((model) => model.metaData.resModel)
);
patch(ProjectEnterpriseTaskListModel.prototype, projectConflictTasksModel());
