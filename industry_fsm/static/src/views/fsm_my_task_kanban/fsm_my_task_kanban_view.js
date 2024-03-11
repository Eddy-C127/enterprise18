import { projectTaskKanbanView } from "@project/views/project_task_kanban/project_task_kanban_view";
import { registry } from "@web/core/registry";
import { FsmMyTaskKanbanRenderer } from "./fsm_my_task_kanban_renderer";

export const fsmMyTaskKanbanView = {
    ...projectTaskKanbanView,
    Renderer: FsmMyTaskKanbanRenderer,
};

registry.category("views").add("fsm_my_task_kanban", fsmMyTaskKanbanView);
