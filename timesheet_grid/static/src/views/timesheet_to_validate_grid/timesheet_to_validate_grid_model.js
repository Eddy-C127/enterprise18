import { registry } from "@web/core/registry";

import { TimesheetToValidateGridModel } from "./timesheet_to_validate_grid_view";
import { timesheetGridView } from "../timesheet_grid/timesheet_grid_view";

export const timesheetToValidateGridView = {
    ...timesheetGridView,
    Model: TimesheetToValidateGridModel,
};

registry.category("views").add("timesheet_to_validate_grid", timesheetToValidateGridView);
