/** @odoo-module **/

import { registry } from "@web/core/registry";
import { patch } from "@web/core/utils/patch";

patch(registry.category("web_tour.tours").get("planning_test_tour"), {
    steps() {
        const originalSteps = super.steps();
        const projectPlanningStartStepIndex = originalSteps.findIndex(
            (step) => step.id && step.id === "project_planning_start"
        );
        originalSteps.splice(
            projectPlanningStartStepIndex + 1,
            0,
            {
                trigger: ".o_field_many2one[name='project_id'] input",
                content: "Create project named-'New Project' for this shift",
                run: "edit New Project",
                in_modal: false,
            },
            {
                isActive: ["auto"],
                trigger: "ul.ui-autocomplete a:contains(New Project)",
                in_modal: false,
                run: "click",
            }
        );
        const projectPlanningEndStepIndex = originalSteps.findIndex(
            (step) => step.id && step.id === "planning_check_format_step"
        );
        originalSteps.splice(
            projectPlanningEndStepIndex + 1,
            0,
            {
                trigger: ".o_gantt_button_add",
                content: "Click Add record to verify the naming format of planning template",
                run: "click",
                in_modal: false,
            },
            {
                trigger: "span.o_selection_badge:contains('[New Project]')",
                content: "Check the naming format of planning template",
                in_modal: false,
            },
            {
                isActive: ["auto"],
                content: "exit the shift modal",
                trigger: ".modal:not(.o_inactive_modal) button[special=cancel]",
                in_modal: false,
                run: "click",
            }
        );

        return originalSteps;
    },
});
