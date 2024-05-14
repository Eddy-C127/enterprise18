/** @odoo-module **/

import { markup } from "@odoo/owl";
import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add('planning_test_tour', {
    url: '/web',
    test: true,
    steps: () => [{
    trigger: '.o_app[data-menu-xmlid="planning.planning_menu_root"]',
    content: "Let's start managing your employees' schedule!",
    position: 'bottom',
}, {
    trigger: ".o_gantt_button_add",
    content: markup("Let's create your first <b>shift</b>."),
    id: 'project_planning_start',
}, {
    trigger: ".o_field_widget[name='resource_id'] input",
    content: markup("Assign this shift to your <b>resource</b>, or leave it open for the moment."),
    run: "edit Mitchell Admin",
}, {
    trigger: ".o-autocomplete--dropdown-item > a:contains('Mitchell Admin')",
    auto: true,
    in_modal: false,
}, {
    trigger: ".o_field_widget[name='role_id'] input",
    content: markup("Select the <b>role</b> your employee will have (<i>e.g. Chef, Bartender, Waiter, etc.</i>)."),
    run: "edit Developer",
}, {
    trigger: ".o-autocomplete--dropdown-item > a:contains('Developer')",
    auto: true,
    in_modal: false,
}, {
    trigger: ".o_field_widget[name='start_datetime'] input",
    content: "Set start datetime",
    run: function (actions) {
        const input = this.anchor;
        input.value = input.value.replace(/(\d{2}:){2}\d{2}/g, '08:00:00');
        input.dispatchEvent(new InputEvent('input', {
            bubbles: true,
        }));
        input.dispatchEvent(new Event("change", { bubbles: true, cancelable: false }));
    }
}, {
    trigger: "input[data-field=end_datetime]",
    content: "Set end datetime",
    run: function (actions) {
        const input = this.anchor;
        input.value = input.value.replace(/(\d{2}:){2}\d{2}/g, '11:59:59');
        input.dispatchEvent(new InputEvent('input', {
            bubbles: true,
        }));
        input.dispatchEvent(new Event("change", { bubbles: true, cancelable: false }));
    }
}, {
    trigger: "button[name='action_save_template']",
    content: "Save this shift as a template",
    run: "click",
}, {
    trigger: "button[special='save']",
    content: "Save this shift once it is ready.",
}, {
    trigger: ".o_gantt_pill :contains('11:59')",
    content: markup("<b>Drag & drop</b> your shift to reschedule it. <i>Tip: hit CTRL (or Cmd) to duplicate it instead.</i> <b>Adjust the size</b> of the shift to modify its period."),
    auto: true,
    run: function () {
        const expected = "8:00 AM - 11:59 AM";
        // Without the replace below, this step could break since luxon
        // (via Intl) uses sometimes U+202f instead of a simple space.
        // Note: U+202f is a narrow non-break space.
        const actual = this.anchor.textContent.replace(/\u202f/g, " ");
        if (!actual.startsWith(expected)) {
            console.error("Test in gantt view doesn't start as expected. Expected : '" + expected + "', actual : '" + actual + "'");
        }
    }
}, {
    trigger: ".o_control_panel .dropdown-toggle",
    content: "Share the schedule with your team by publishing and sending it. Open the menu to access this option.",
    position: "top",
    mobile: true,
}, {
    trigger: ".o_gantt_button_send_all",
    content: markup("If you are happy with your planning, you can now <b>send</b> it to your employees."),
}, {
    trigger: "button[name='action_check_emails']",
    content: markup("<b>Publish & send</b> your planning to make it available to your employees."),
}, {
    trigger: ".o_gantt_row_header:contains('Mitchell Admin') .o_gantt_progress_bar",
    content: "See employee progress bar",
    auto: true,
    run: function () {
        if (this.anchor.querySelector("span").style.width === '') {
            console.error("Progress bar should be displayed");
        }
        if (!this.anchor.classList.contains("o_gantt_group_success")) {
            console.error("Progress bar should be displayed in success");
        }
    }
}, {
    trigger: ".o_control_panel .dropdown-toggle",
    content: "Plan your shifts in one click by copying the schedule from the previous week. Open the menu to access this option.",
    position: "top",
}, {
    trigger: ".o_gantt_button_copy_previous_week",
    content: "Copy previous week if you want to follow previous week planning schedule",
    position: "right",
    run: 'click',
}, {
    id: "planning_check_format_step",
    trigger: ".o_gantt_pill span:contains(Developer)",
    content: "Check naming format of resource and role when grouped",
    auto: true,
    run: function () {}
}, {
    trigger: ".o_control_panel .dropdown-toggle",
    content: "Automatically match open shifts and sales orders to the right people, taking into account their working hours, roles, availability, and time off. Open the menu to access this option.",
    position: "top",
}, {
    trigger: ".o_gantt_button_auto_plan",
    content: "Click on Auto Plan button to assign open shifts to employees",
    position: "right",
    run: 'click',
}, {
    id: "planning_check_format_step",
    trigger: ".o_gantt_pill.opacity-25",
    content: "Check that the filter is applied",
    auto: true,
    run: function () {},
}]});

registry.category("web_tour.tours").add('planning_test_tour_no_email', {
    url: '/web',
    test: true,
    steps: () => [{
    trigger: '.o_app[data-menu-xmlid="planning.planning_menu_root"]',
    content: "Open the planning app, should land in the gantt view",
    position: 'bottom',
}, {
    trigger: ".o_gantt_button_send_all",
    content: "Click on the 'Publish' button on the top-left of the gantt view to publish the draft shifts",
}, {
    trigger: "button[name='action_check_emails']",
    content: "The 'No Email Address for some Empoyees' wizard should be raised since we haven't given an employee email",
}, {
    trigger: "td[data-tooltip='Aaron']",
    isCheck: true,
}, {
    trigger: "button[special='cancel']",
}, {
    trigger: '.o_gantt_pill :contains("aaron_role")',
    content: "Click on the shift of Aaron",
}, {
    trigger: ".popover-footer button",
    content: "Click on the 'Edit' button in the popover",
}, {
    trigger: "button[name='action_send']",
    content: "Click on the 'Publish' button",
}, {
    trigger: ".o_field_widget.o_field_image.oe_avatar",
    content: "The 'No Email Address for the Employee' wizard should be raised",
    isCheck: true,
},]});

registry.category("web_tour.tours").add('planning_shift_switching_backend', {
    url: '/web',
    test: true,
    steps: () => [{
    trigger: '.o_app[data-menu-xmlid="planning.planning_menu_root"]',
    content: "Get in the planning app",
}, {
    trigger: '.o_gantt_pill :contains("test_role")',
    content: "Click on one of your shifts in the gantt view",
},
{
    trigger: ".popover-footer button",
    content: "Click on the 'Edit' button in the popover",
    run: 'click',
},
{
    trigger: 'button[name="action_switch_shift"]',
    content: "Click on the 'Switch Shift' button on the Gantt Form view modal",
}, {
    trigger: 'div.o_view_scale_selector > .scale_button_selection',
    content: 'Toggle the view scale selector',
}, {
    trigger: '.dropdown-menu .o_scale_button_day',
    content: 'Click on the dropdown button to change the scale of the gantt view',
}, {
    trigger: '.o_gantt_pill :contains("test_role")',
    content: "Click on the unwanted shift in the gantt view again",
},
{
    trigger: ".popover-footer button",
    content: "Click again on the 'Edit' button in the popover",
    run: 'click',
},
{
    trigger: '.alert-warning:contains("The employee assigned would like to switch shifts with someone else.")',
    content: "Check that the warning has been shown",
}, {
    trigger: '.btn-close',
    content: "Click on the close button to hide the shift form modal",
}, {
    trigger: '.o_planning_gantt',
    isCheck: true,
}]});

registry.category("web_tour.tours").add('planning_assigning_unwanted_shift_backend', {
    url: '/web',
    test: true,
    steps: () => [{
    trigger: '.o_app[data-menu-xmlid="planning.planning_menu_root"]',
    content: "Get in the planning app",
}, {
    trigger: '.o_gantt_pill :contains("test_role")',
    content: "Click on the unwanted shift of the employee",
},
{
    trigger: ".popover-footer button",
    content: "Click on the 'Edit' button in the popover",
    run: 'click',
},
{
    trigger: ".o_field_widget[name='resource_id'] input",
    content: "Assign this shift to another employee.",
    run: "edit joseph",
}, {
    trigger: ".o-autocomplete--dropdown-item > a:contains('joseph')",
    auto: true,
    in_modal: false,
}, {
    trigger: "button[special='save']",
    content: "Save this shift once it is ready.",
}, {
    trigger: '.o_gantt_pill :contains("test_role")',
    content: "Click again on the newly assigned shift",
}, {
    trigger: '.o_popover',
    content: "Check the popover opened",
    isCheck: true,
}]});
