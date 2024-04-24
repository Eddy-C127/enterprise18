/** @odoo-module **/

import { registry } from "@web/core/registry";
import { mapView } from "@web_map/map_view/map_view";
import { ProjectTaskMapModel } from "./project_task_map_model";
import { ProjectTaskMapRenderer } from "./project_task_map_renderer";

registry.category("views").add("project_task_map", {
    ...mapView,
    Model: ProjectTaskMapModel,
    Renderer: ProjectTaskMapRenderer,
});
