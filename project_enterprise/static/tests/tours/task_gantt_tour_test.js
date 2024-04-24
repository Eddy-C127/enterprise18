/**
 * Add custom steps to go to map and gantt view in Project app
 */
import { registry } from "@web/core/registry";
import "@project/../tests/tours/project_tour";
import { patch } from "@web/core/utils/patch";
import { click, queryLast } from "@odoo/hoot-dom";


patch(registry.category("web_tour.tours").get("project_test_tour"), {
    steps() {
        const originalSteps = super.steps();
        const taskCreationStepIndex = originalSteps.findIndex((step) => step.id === "quick_create_tasks");

        originalSteps.splice(taskCreationStepIndex + 1, 0, {
            trigger: '.o_switch_view.o_gantt',
            content: 'Open Gantt View',
        }, {
            id: 'gantt_add_task',
            trigger: '.o_gantt_button_add',
            content: 'Add a task in gantt',
        });

        originalSteps.splice(originalSteps.length, 0, {
            trigger: ".o_gantt_picker:last-child",
            content: "Open right date picker",
        },
        {
            trigger: '.o_zoom_out[title="Select month"]',
            content: "Click on selected month",
        },
        {
            extra_trigger: '[title="Select year"]',
            trigger: ".o_today",
            content: "Select current month",
        },
        {
            trigger: '.o_zoom_out[title="Select month"]',
            content: "Select last day of current month",
            run() {
                click(queryLast(".o_date_item_cell:not(.o_out_of_range)"));
            },
        },
        {
            trigger: ".o_gantt_progress_bar.o_gantt_group_danger",
            content: "See user progress bar",
            run() {},
        })
        return originalSteps;
    }
});
