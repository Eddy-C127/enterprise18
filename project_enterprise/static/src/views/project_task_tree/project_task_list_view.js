import { projectTaskListView } from "@project/views/project_task_list/project_task_list_view";
import { ProjectEnterpriseTaskListModel } from "./project_task_list_model";
import { registry } from "@web/core/registry";

export const projectEnterpriseTaskListView = {
    ...projectTaskListView,
    Model: ProjectEnterpriseTaskListModel,
};
registry.category("views").add("project_enterprise_task_list", projectEnterpriseTaskListView);
