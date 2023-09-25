import { projectModels } from "@project/../tests/project_models";
import { fields } from "@web/../tests/web_test_helpers";

export class ProjectTask extends projectModels.ProjectTask {
    _name = "project.task";

    planned_date_begin = fields.Datetime({ string: "Start Date" });
    planned_date_end = fields.Datetime({ string: "End Date" });
    planning_overlap = fields.Html();
}

projectModels.ProjectTask = ProjectTask;
