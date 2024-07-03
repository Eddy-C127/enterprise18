/** @odoo-module **/

import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add("test_shop_floor", {
    test: true,
    steps: () => [
    {
        content: 'Select the workcenter the first time we enter in shopfloor',
        trigger: '.form-check:has(input[name="Jungle"])',
        run: "click",
    },
    {
        trigger: '.form-check:has(input[name="Jungle"]:checked)',
    },
    {
        trigger: 'footer.modal-footer button.btn-primary',
        run: "click",
    },
    {
        trigger: '.o_control_panel_actions button:contains("Jungle")',
    },
    {
        content: 'Open the employee panel',
        trigger: 'button[name="employeePanelButton"]',
        run: "click",
    },
    {
        content: 'Add operator button',
        trigger: 'button:contains("Operator")',
        run: "click",
    },
    {
        content: 'Select the Marc Demo employee',
        trigger: '.modal-body .o_mrp_employee_tree_view .o_data_row td:contains("Billy Demo")',
        run: "click",
    },
    {
        trigger: '.o_mrp_employees_panel li.o_admin_user:contains(Billy Demo)',
    },
    {
        content: 'Go to workcenter Savannah from MO card',
        trigger: '.o_mrp_record_line button span:contains("Savannah")',
        run: "click",
    },
    {
        trigger: '.o_control_panel_actions button.active:contains("Savannah")',
    },
    {
        content: 'Start the workorder on header click',
        trigger: '.o_finished_product span:contains("Giraffe")',
        run: "click",
    },
    {
        content: 'Open instruction',
        trigger: 'button:contains("Instructions")',
        run: "click",
        },
        {
            content: "Register production check",
            trigger: ".modal:not(.o_inactive_modal) .btn.fa-plus",
            in_modal: false,
            run: "click",
        },
        {
            content: "Close production check",
            trigger: ".modal:not(.o_inactive_modal) button.btn-close",
            in_modal: false,
            run: "click",
        },
        {
            trigger: "body:not(:has(.modal))",
        },
        {
            content: "Open instruction",
            trigger: 'button:contains("Instructions")',
            run: "click",
        },
        {
            content: "Validate production check",
            trigger: '.modal:not(.o_inactive_modal) button:contains("Validate")',
            in_modal: false,
            run: "click",
        },
        {
            trigger:
                '.modal:not(.o_inactive_modal):contains(Instructions) button[barcode_trigger="NEXT"]',
            in_modal: false,
            run: "click",
        },
        {
            trigger: '.modal:not(.o_inactive_modal) .modal-title:contains("Register legs")',
            in_modal: false,
        },
        {
            content: "Component not tracked registration and continue production",
            trigger:
                '.modal:not(.o_inactive_modal):contains(Register legs) button[barcode_trigger="CONT"]',
            in_modal: false,
            run: "click",
        },
        {
            trigger: '.o_field_widget[name="qty_done"] input:value("0.00")',
        },
        {
            content: "Add 2 units",
            trigger: '.o_field_widget[name="qty_done"] input',
            run: "edit 2 && click .modal-body",
        },
        {
            trigger: '.o_field_widget[name="qty_done"] input:value("2.00")',
        },
        {
            content: 'Click on "Validate"',
            trigger: 'button[barcode_trigger="NEXT"]',
            run: "click",
        },
        {
            trigger: '.modal:not(.o_inactive_modal) .modal-title:contains("Release")',
            in_modal: false,
        },
        {
            trigger: ".modal:not(.o_inactive_modal) .modal-header .btn-close",
            in_modal: false,
            run: "click",
        },
        {
            content: 'Open instruction',
            trigger: 'button:contains("Instructions")',
            run: "click",
        },
        {
            trigger: '.modal:not(.o_inactive_modal) .modal-title:contains("Release")',
            in_modal: false,
        },
        {
            trigger: '.modal:not(.o_inactive_modal) button[barcode_trigger="NEXT"]',
            in_modal: false,
            run: "click",
        },
        {
            content: "Close first operation",
            trigger: '.card-footer button[barcode_trigger="CLWO"]:contains(Mark as Done)',
            in_modal: false,
            run: "click",
        },
        {
            content: "Navigate to next operation",
            trigger: "button:contains(Next Operation)",
            run: "click",
        },
        {
            content: "Open the WO setting menu again",
            trigger: '.o_mrp_display_record:contains("Release") .card-footer button.fa-gear',
            run: "click",
        },
        {
            content: "Add an operation button",
            trigger: '.modal:not(.o_inactive_modal) button[name="addComponent"]',
            in_modal: false,
            run: "click",
        },
        {
            content: "Add Color",
            trigger: ".modal:not(.o_inactive_modal) .o_field_widget[name=product_id] input",
            in_modal: false,
            run: "edit color",
        },
        {
            trigger: '.ui-menu-item > a:contains("Color")',
            run: "click",
            in_modal: false,
        },
        {
            trigger: ".modal:not(.o_inactive_modal) button[name=add_product]",
            in_modal: false,
            run: "click",
        },
        {
            trigger: "body:not(:has(.modal))",
            in_modal: false,
        },
        {
            trigger: "button[barcode_trigger=CLWO]:contains(Mark as Done)",
            in_modal: false,
            run: "click",
        },
        {
            trigger: "button[barcode_trigger=CLMO]",
            run: "click",
        },
        {
            trigger: ".o_nocontent_help",
        },
        {
            content: "Leave shopfloor",
            trigger: ".o_home_menu .fa-sign-out",
            run: "click",
        },
        {
            trigger: ".o_apps",
        },
    ],
});

registry.category("web_tour.tours").add("test_generate_serials_in_shopfloor", {
    test: true,
    steps: () => [
    {
        content: 'Make sure workcenter is available',
        trigger: '.form-check:has(input[name="Assembly Line"])',
        run: "click",
    },
    {
        trigger: '.form-check:has(input[name="Assembly Line"]:checked)',
    },
    {
        content: 'Confirm workcenter',
        trigger: 'button:contains("Confirm")',
        run: "click",
    },
    {
        content: 'Select workcenter',
        trigger: 'button.btn-light:contains("Assembly Line")',
        run: "click",
    },
    {
        content: 'Open the wizard',
        trigger: '.o_mrp_record_line .text-truncate:contains("Register byprod")',
        run: "click",
    },
    {
        content: 'Open the serials generation wizard',
        trigger: '.o_widget_generate_serials button',
        run: "click",
    },
    {
        content: 'Input a serial',
        trigger: '#next_serial_0',
        run: "edit 00001",
    },
    {
        content: 'Generate the serials',
        trigger: 'button.btn-primary:contains("Generate")',
        run: "click",
    },
    {
        content: 'Save and close the wizard',
        trigger: '.o_form_button_save:contains("Save")',
        run: "click",
    },
    {
        content: 'Set production as done',
        trigger: 'button.btn-primary:contains("Mark as Done")',
        run: "click",
    },
    {
        content: 'Close production',
        trigger: 'button.btn-primary:contains("Close Production")',
    },
    ],
});

registry.category("web_tour.tours").add("test_canceled_wo", {
    test: true,
    steps: () => [
        {
            content: 'Make sure workcenter is available',
            trigger: '.form-check:has(input[name="Assembly Line"])',
            run: "click",
        },
        {
            trigger: '.form-check:has(input[name="Assembly Line"]:checked)',
        },
        {
            content: 'Confirm workcenter',
            trigger: 'button:contains("Confirm")',
            run: "click",
        },
        {
            content: 'Check MO',
            trigger: 'button.btn-light:contains("Assembly Line")',
            run: () => {
                if (document.querySelectorAll("ul button:not(.btn-secondary)").length > 1)
                    console.error("Multiple Workorders");
            },
        },
    ],
});
