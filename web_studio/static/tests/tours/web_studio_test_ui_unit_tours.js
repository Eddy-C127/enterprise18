/** @odoo-module */
import { registry } from "@web/core/registry";
import { stepNotInStudio, assertEqual } from "@web_studio/../tests/tours/tour_helpers";
import { queryFirst } from "@odoo/hoot-dom";

registry
    .category("web_tour.tours")
    .add("web_studio_test_form_view_not_altered_by_studio_xml_edition", {
        test: true,
        url: "/web?debug=1",
        sequence: 260,
        steps: () => [
            {
                trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
                run: "click",
            },
            {
                trigger: ".o_form_view .o_form_editable",
                run: "click",
            },
            {
                trigger: ".o_web_studio_navbar_item button",
                run: "click",
            },
            {
                trigger: ".o_web_studio_sidebar .o_web_studio_view",
                run: "click",
            },
            {
                trigger: ".o_web_studio_open_xml_editor",
                run: "click",
            },
            {
                extra_trigger: ".o_web_studio_code_editor_info",
                trigger: ".o_web_studio_leave",
                run: "click",
            },
            stepNotInStudio(".o_form_view .o_form_editable"),
        ],
    });

/* global ace */
registry.category("web_tour.tours").add("web_studio_test_edit_with_xml_editor", {
    test: true,
    url: "/web?debug=1",
    sequence: 260,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            extra_trigger: ".someDiv",
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_view",
            run: "click",
        },
        {
            trigger: ".o_web_studio_open_xml_editor",
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_xml_editor",
            trigger: ".o_web_studio_xml_resource_selector .o_select_menu_toggler",
            run: "click",
        },
        {
            trigger: ".o-dropdown--menu .o_select_menu_item:contains(Odoo Studio)",
            run: "click",
        },
        {
            trigger: ".ace_content",
            run() {
                ace.edit(document.querySelector(".ace_editor")).setValue("<data/>");
            },
        },
        {
            trigger: ".o_web_studio_xml_editor .o_web_studio_xml_resource_selector .btn-primary",
            run: "click",
        },
        {
            trigger: ".o_web_studio_snackbar:not(:has(.fa-spin))",
            run: "click",
        },
        {
            trigger: ".o_form_view",
            run() {
                if (document.querySelector(".someDiv")) {
                    throw new Error("The edition of the view's arch via the xml editor failed");
                }
            },
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_enter_x2many_edition_and_add_field", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            trigger: ".o_form_view .o_form_editable",
            run: "click",
        },
        {
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_studio_form_view_editor .o_field_widget[name='user_ids']",
            run: "click",
        },
        {
            extra_trigger: ".o-web-studio-edit-x2manys-buttons",
            trigger: ".o_web_studio_editX2Many[data-type='form']",
            run: "click",
        },
        {
            extra_trigger: ".o_view_controller.o_form_view.test-user-form",
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_header",
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_existing_fields_section:not(.d-none)",
            trigger:
                ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(User log entries)",
            run() {
                queryFirst(
                    ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(User log entries)"
                ).scrollIntoView();
            },
        },
        {
            trigger:
                ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(User log entries)",
            run: "drag_and_drop(.o_web_studio_form_view_editor .o_web_studio_hook:eq(1))",
        },
        {
            trigger: ".o_web_studio_form_view_editor .o_field_widget[name='log_ids']",
            run() {
                const countFields = document.querySelectorAll(
                    ".o_web_studio_form_view_editor .o_field_widget"
                ).length;
                if (!countFields === 2) {
                    throw new Error("There should be 2 fields in the form view");
                }
            },
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_enter_x2many_auto_inlined_subview", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            trigger: ".o_form_view .o_form_editable",
            run: "click",
        },
        {
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger:
                ".o_web_studio_form_view_editor .o_field_widget[name='user_ids'] .o_field_x2many_list",
            run: "click",
        },
        {
            extra_trigger: ".o-web-studio-edit-x2manys-buttons",
            trigger: ".o_web_studio_editX2Many[data-type='list']",
            run: "click",
        },
        {
            extra_trigger: ".o_view_controller.o_list_view.test-user-list",
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_header",
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_existing_fields_section:not(.d-none)",
            trigger:
                ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(User log entries)",
            run() {
                queryFirst(
                    ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(User log entries)"
                ).scrollIntoView();
            },
        },
        {
            trigger:
                ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(User log entries)",
            run: "drag_and_drop(.o_web_studio_list_view_editor .o_web_studio_hook:eq(1))",
        },
        {
            trigger: ".o_web_studio_list_view_editor th[data-name='log_ids']",
            run() {
                const countFields = document.querySelectorAll(
                    ".o_web_studio_form_view_editor th[data-name]"
                ).length;
                if (!countFields === 2) {
                    throw new Error("There should be 2 fields in the form view");
                }
            },
        },
    ],
});

registry
    .category("web_tour.tours")
    .add("web_studio_enter_x2many_auto_inlined_subview_with_multiple_field_matching", {
        test: true,
        sequence: 260,
        steps: () => [
            {
                trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
                run: "click",
            },
            {
                trigger: ".o_form_view .o_form_editable",
                run: "click",
            },
            {
                trigger: ".o_web_studio_navbar_item button",
                run: "click",
            },
            {
                trigger:
                    ".o_web_studio_form_view_editor .o_field_widget[name='user_ids']:eq(1) .o_field_x2many_list",
                run: "click",
            },
            {
                extra_trigger: ".o-web-studio-edit-x2manys-buttons",
                trigger: ".o_web_studio_editX2Many[data-type='list']",
                run: "click",
            },
            {
                extra_trigger: ".o_view_controller.o_list_view.test-user-list",
                trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_header",
                run: "click",
            },
            {
                extra_trigger: ".o_web_studio_existing_fields_section:not(.d-none)",
                trigger:
                    ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(User log entries)",
                run() {
                    queryFirst(
                        ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(User log entries)"
                    ).scrollIntoView();
                },
            },
            {
                trigger:
                    ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(User log entries)",
                run: "drag_and_drop(.o_web_studio_list_view_editor .o_web_studio_hook:eq(1))",
            },
            {
                trigger: ".o_web_studio_list_view_editor th[data-name='log_ids']",
                run() {
                    const countFields = document.querySelectorAll(
                        ".o_web_studio_form_view_editor th[data-name]"
                    ).length;
                    if (!countFields === 2) {
                        throw new Error("There should be 2 fields in the form view");
                    }
                },
            },
        ],
    });

registry.category("web_tour.tours").add("web_studio_boolean_field_drag_and_drop", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            trigger: ".o_form_view .o_form_editable",
            run: "click",
        },
        {
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_new_fields .o_web_studio_field_boolean",
            run: "drag_and_drop(.o_web_studio_form_view_editor .o_web_studio_hook:eq(0))",
        },
        {
            extra_trigger: ".o_web_studio_form_view_editor",
            trigger: ".o_wrap_field_boolean .o_wrap_label",
            run: "drag_and_drop(.o_web_studio_form_view_editor .o_web_studio_hook:eq(2))",
        },
        {
            trigger: ".o_wrap_label:eq(1):contains('New CheckBox')",
            run() {},
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_field_with_group", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            trigger: ".o_list_view",
            run: "click",
        },
        {
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_studio_list_view_editor th[data-name='function']",
            run() {},
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_header",
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_existing_fields_section:not(.d-none)",
            trigger:
                ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(Website Link)",
            run() {
                queryFirst(
                    ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(Website Link)"
                ).scrollIntoView();
            },
        },
        {
            trigger:
                ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(Website Link)",
            run: "drag_and_drop(.o_web_studio_list_view_editor th.o_web_studio_hook:eq(2))",
        },
        {
            extra_trigger:
                ".o_web_studio_list_view_editor th.o_web_studio_hook:not(.o_web_studio_nearest_hook)",
            trigger: ".o_web_studio_list_view_editor th[data-name='website']",
            run() {
                const countFields = document.querySelectorAll(
                    ".o_web_studio_list_view_editor th[data-name]"
                ).length;
                if (!countFields === 3) {
                    throw new Error("There should be 3 fields in the form view");
                }
            },
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_set_tree_node_conditional_invisibility", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            trigger: ".o_web_studio_navbar_item button",
            extra_trigger: ".o_list_view",
            run: "click",
        },
        {
            trigger: ".o_web_studio_list_view_editor th[data-name='title']",
            run: "click",
        },
        {
            trigger: ".o_web_studio_sidebar_checkbox:nth-child(1) .o_web_studio_attrs",
            run: "click",
        },
        {
            trigger: ".o_model_field_selector_value",
            run: "click",
        },
        {
            trigger: ".o_model_field_selector_popover_item_name:contains('Display Name')",
            in_modal: false,
            run: "click",
        },
        {
            trigger: ".o_tree_editor_condition input.o_input",
            run: "edit Robert && click body",
        },
        {
            trigger: ".modal-footer .btn-primary",
            run: "click",
        },
        {
            trigger: ".o_web_studio_list_view_editor th[data-name='title']",
            isCheck: true,
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_elements_with_groups_form", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            trigger: ".o_form_view",
            run: "click",
        },
        {
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_studio_form_view_editor",
            run() {},
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_header",
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_existing_fields_section:not(.d-none)",
            trigger:
                ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(Website Link)",
            run() {
                queryFirst(
                    ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(Website Link)"
                ).scrollIntoView();
            },
        },
        {
            trigger:
                ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(Website Link)",
            run: "drag_and_drop(.o_web_studio_form_view_editor .o_inner_group .o_web_studio_hook:eq(1))",
        },
        {
            extra_trigger:
                ".o_web_studio_form_view_editor .o_web_studio_hook:not(.o_web_studio_nearest_hook)",
            trigger: ".o_web_studio_form_view_editor .o_field_widget[name='website']",
            allowInvisible: true,
            run() {
                const countFields = document.querySelectorAll(
                    ".o_web_studio_form_view_editor .o_field_widget[name]"
                ).length;
                if (!countFields === 2) {
                    throw new Error("There should be 2 fields in the form view");
                }
            },
        },
    ],
});

registry.category("web_tour.tours").add("test_element_group_in_sidebar", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            trigger: ".o_form_view .o_form_editable",
            run: "click",
        },
        {
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_form_view_editor .o_field_widget[name='display_name']",
            trigger: ".o_web_studio_form_view_editor .o_field_widget[name='display_name']",
            run: "click",
        },
        {
            trigger: ".o_field_many2many_tags[name='groups_id'] .badge",
            run() {
                const tag = document.querySelector(
                    ".o_field_many2many_tags[name='groups_id'] .badge"
                );
                if (!tag || !tag.textContent.includes("Test Group")) {
                    throw new Error("The groups should be displayed in the sidebar");
                }
            },
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_custom_selection_field_edit_values", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            extra_trigger: ".o_form_view",
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_new_fields .o_web_studio_field_selection",
            run: "drag_and_drop(.o_web_studio_hook:eq(0))",
        },
        {
            trigger: ".o_web_studio_add_selection .o-web-studio-interactive-list-item-input",
            run: "edit some value",
        },
        {
            trigger: ".modal-footer .btn-primary",
            run: "click",
        },
        {
            extra_trigger: "body:not(:has(.modal))",
            trigger: ".o_web_studio_leave",
            run: "click",
        },
        {
            extra_trigger: ".o_form_view",
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_studio_form_view_editor .o_wrap_input:has(.o_field_selection)",
            run: "click",
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_edit_selection_values",
            run: "click",
        },
        {
            in_modal: true,
            trigger: ".o_web_studio_add_selection .o-web-studio-interactive-list-item-input",
            run: "edit another value cancel",
        },
        {
            trigger: ".o_web_studio_add_selection .o-web-studio-interactive-list-edit-item",
            run: "click",
        },
        {
            trigger: ".o_web_studio_selection_editor li:nth-child(2)",
            async run() {
                assertEqual(this.anchor.textContent, "another value cancel");
            },
        },
        {
            trigger: ".modal-footer .btn-secondary",
            run: "click",
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_edit_selection_values",
            run: "click",
        },
        {
            trigger: ".o_web_studio_selection_editor li",
            run() {
                assertEqual(this.anchor.textContent, "some value");
            },
        },
        {
            in_modal: true,
            trigger: ".o_web_studio_add_selection .o-web-studio-interactive-list-item-input",
            run: "edit another value",
        },
        {
            trigger: ".modal-footer .btn-primary",
            run: "click",
        },
        {
            extra_trigger: "body:not(:has(.modal))",
            trigger: ".o_web_studio_leave",
            run: "click",
        },
        stepNotInStudio(),
    ],
});

registry.category("web_tour.tours").add("web_studio_test_create_one2many_lines_then_edit_name", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            extra_trigger: ".o_form_view",
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_new_fields .o_web_studio_field_lines",
            run: "drag_and_drop(.o_web_studio_hook:eq(0))",
        },
        {
            trigger: ".o_form_label",
            extra_trigger: ".o_field_x2many_list",
            timeout: 20000,
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_sidebar .o_web_studio_properties.active",
            trigger: "input[name='string']",
            run: "edit new name && click body",
        },
        {
            trigger: ".o_web_studio_leave",
            timeout: 20000,
            run: "click",
        },
        stepNotInStudio(".o_form_view"),
    ],
});

registry.category("web_tour.tours").add("web_studio_test_address_view_id_no_edit", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            extra_trigger: ".o_form_view",
            trigger: ".o_address_format",
            run: function () {
                if (
                    this.anchor.querySelectorAll("[name=lang]").length ||
                    !this.anchor.querySelectorAll("[name=street]").length
                ) {
                    throw new Error(
                        "The address view id set on the company country should be displayed"
                    );
                }
            },
        },
        {
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_view_renderer",
            trigger: ".o_address_format",
            run: function () {
                if (
                    this.anchor.querySelectorAll("[name=street]").length ||
                    !this.anchor.querySelectorAll("[name=lang]").length
                ) {
                    throw new Error(
                        "The address view id set on the company country shouldn't be editable"
                    );
                }
            },
        },
        {
            trigger: ".o_web_studio_leave",
            run: "click",
        },
        stepNotInStudio(".o_form_view"),
    ],
});

registry.category("web_tour.tours").add("web_studio_test_create_new_model_from_existing_view", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            extra_trigger: ".o_kanban_view",
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_create_new_model",
            run: "click",
        },
        {
            extra_trigger: ".modal-dialog",
            trigger: "input[name='model_name']",
            run: "edit new model",
        },
        {
            trigger: ".confirm_button",
            run: "click",
        },
        {
            trigger: ".o_web_studio_model_configurator_next",
            run: "click",
        },
        {
            trigger: ".o_form_view",
            isCheck: true,
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_test_create_model_with_clickable_stages", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            extra_trigger: ".o_form_view",
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_create_new_model",
            run: "click",
        },
        {
            extra_trigger: ".modal-dialog",
            trigger: "input[name='model_name']",
            run: "edit new model",
        },
        {
            trigger: ".confirm_button",
            run: "click",
        },
        {
            trigger: "#use_stages",
            run: "click",
        },
        {
            trigger: ".o_web_studio_model_configurator_next",
            run: "click",
        },
        {
            trigger: ".o_web_studio_leave",
            run: "click",
        },
        {
            extra_trigger: ".o_form_view",
            trigger: "input#x_name_0",
            run: "edit new record",
        },
        {
            trigger: ".o_arrow_button:contains(In Progress)",
            run: "click",
        },
        {
            extra_trigger: ".o_arrow_button_current:contains(In Progress)",
            trigger: ".o_form_button_save",
            run: "click",
        },
        {
            // trigger: ".o_back_button", TODO: add breacrumb to access multi-record view when closing studio
            trigger: ".o_nav_entry:contains(new model)",
            run: "click",
        },
        {
            trigger:
                ".o_kanban_group:contains(In Progress) .o_kanban_record_details:contains(new record)",
            isCheck: true,
        },
    ],
});

registry
    .category("web_tour.tours")
    .add("web_studio_test_enter_x2many_edition_with_multiple_subviews", {
        test: true,
        sequence: 260,
        steps: () => [
            {
                trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
                run: "click",
            },
            {
                extra_trigger: ".o_form_view span:contains('Address Type')",
                trigger: ".o_web_studio_navbar_item button",
                run: "click",
            },
            {
                trigger:
                    ".o_web_studio_form_view_editor .o_field_widget[name='child_ids'] .o_field_x2many_list",
                extra_trigger: ".o_list_renderer span:contains('Address Type')",
                run: "click",
            },
            {
                extra_trigger: ".o-web-studio-edit-x2manys-buttons",
                trigger: ".o_web_studio_editX2Many[data-type='list']",
                run: "click",
            },
            {
                trigger: ".o_content > .o_list_renderer span:contains('Address Type')",
                isCheck: true,
            },
        ],
    });

registry
    .category("web_tour.tours")
    .add("web_studio_test_enter_x2many_edition_with_multiple_subviews_correct_xpath", {
        test: true,
        sequence: 260,
        steps: () => [
            {
                trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
                run: "click",
            },
            {
                extra_trigger: ".o_form_view",
                trigger: ".o_web_studio_navbar_item button",
                run: "click",
            },
            {
                trigger:
                    ".o_web_studio_form_view_editor .o_field_widget[name='child_ids'] .o_field_x2many_list",
                run: "click",
            },
            {
                extra_trigger: ".o-web-studio-edit-x2manys-buttons",
                trigger: ".o_web_studio_editX2Many[data-type='list']",
                run: "click",
            },
            {
                extra_trigger: ".o_view_controller.o_list_view.test-subview-list",
                trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_header",
                run: "click",
            },
            {
                extra_trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_section",
                trigger: `.o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component[data-drop='${JSON.stringify(
                    { fieldName: "active" }
                )}']`,
                run: "drag_and_drop(.o_web_studio_hook:eq(0))",
            },
            {
                content: "Check that the active field has been added",
                trigger: ".o_web_studio_view_renderer .o_list_view thead th[data-name='active']",
                isCheck: true,
            },
        ],
    });

registry.category("web_tour.tours").add("web_studio_test_studio_view_is_last", {
    test: true,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            extra_trigger: ".o_form_view",
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_header",
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_existing_fields_section:not(.d-none)",
            trigger:
                ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(Website Link)",
            run() {
                queryFirst(
                    ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(Website Link)"
                ).scrollIntoView();
            },
        },
        {
            trigger:
                ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(Website Link)",
            run: "drag_and_drop(.o_web_studio_form_view_editor .o_inner_group .o_web_studio_hook:last)",
        },
        {
            trigger: ".o_web_studio_form_view_editor .o_field_widget[name='website']",
            allowInvisible: true,
            run() {},
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_test_edit_form_subview_attributes", {
    test: true,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            extra_trigger: ".o_form_view",
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger:
                ".o_web_studio_form_view_editor .o_field_widget[name='child_ids'] .o_field_x2many_list",
            run: "click",
        },
        {
            extra_trigger: ".o-web-studio-edit-x2manys-buttons",
            trigger: ".o_web_studio_editX2Many[data-type='form']",
            run: "click",
        },
        {
            extra_trigger: ".o_view_controller.o_form_view.test-subview-form",
            trigger: ".o_web_studio_sidebar.o_notebook .nav-link:contains(View)",
            run: "click",
        },
        {
            trigger: ".o_web_studio_sidebar input[name='create']:checked",
            run: "click",
        },
        {
            trigger: ".o_web_studio_sidebar input[name='create']:not(:checked)",
            run() {},
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_x2many_two_levels_edition", {
    test: true,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            trigger: ".o_form_view .o_form_editable",
            run: "click",
        },
        {
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_studio_form_view_editor .o_field_widget[name='user_ids']",
            run: "click",
        },
        {
            extra_trigger: ".o-web-studio-edit-x2manys-buttons",
            trigger: ".o_web_studio_editX2Many[data-type='form']",
            run: "click",
        },
        {
            extra_trigger: ".o_view_controller.o_form_view.test-subview-form-1",
            trigger: ".o_web_studio_form_view_editor .o_field_widget[name='log_ids']",
            run: "click",
        },
        {
            trigger: ".o_web_studio_editX2Many[data-type='form']",
            run: "click",
        },
        {
            trigger: ".o_view_controller.o_form_view.test-subview-form-2",
            run() {},
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_existing_fields_header",
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_existing_fields",
            trigger:
                ".o_web_studio_sidebar .o_web_studio_existing_fields_section .o_web_studio_component:contains(Created on)",
            run: "drag_and_drop .o_web_studio_hook",
        },
        {
            trigger: ".o_web_studio_form_view_editor [data-field-name='create_date']",
            run() {},
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_field_group_studio_no_fetch", {
    test: true,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            trigger: ".o_form_view .o_form_editable",
            run: "click",
        },
        {
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_studio_form_view_editor",
            run() {
                assertEqual(this.anchor.querySelectorAll(".o_field_widget").length, 1);
                assertEqual(
                    this.anchor.querySelectorAll(".o_field_widget")[0].dataset.studioXpath,
                    "/form[1]/field[2]"
                );
            },
        },
        {
            trigger: ".o_web_studio_views_icons a[title='List']",
            run: "click",
        },
        {
            trigger: ".o_web_studio_list_view_editor",
            run() {
                assertEqual(this.anchor.querySelectorAll("th:not(.o_web_studio_hook)").length, 1);
                assertEqual(
                    this.anchor.querySelectorAll("th:not(.o_web_studio_hook)")[0].dataset
                        .studioXpath,
                    "/tree[1]/field[2]"
                );
            },
        },
        {
            trigger: ".o_web_studio_views_icons a[title='Kanban']",
            run: "click",
        },
        {
            trigger: ".o_web_studio_kanban_view_editor",
            run() {
                assertEqual(
                    this.anchor.querySelectorAll(
                        ".o_kanban_record:not(.o_kanban_demo):not(.o_kanban_ghost) [data-field-name]"
                    ).length,
                    1
                );
                assertEqual(
                    this.anchor
                        .querySelectorAll(
                            ".o_kanban_record:not(.o_kanban_demo):not(.o_kanban_ghost) [data-field-name]"
                        )[0]
                        .getAttribute("studioxpath"),
                    "/kanban[1]/t[1]/field[2]"
                );
            },
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_test_move_similar_field", {
    test: true,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            extra_trigger: ".o_form_view",
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_form_view_editor",
            trigger: ".o_notebook_headers a:contains('two')",
            run: "click",
        },
        {
            trigger: ".tab-pane.active [data-field-name=display_name]",
            run: "drag_and_drop(.o_web_studio_form_view_editor .o_web_studio_hook:eq(1))",
        },
        {
            trigger: ".o_web_studio_leave",
            run() {},
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_test_related_file", {
    test: true,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_user_menu']",
            run: "click",
        },
        {
            content: "second",
            extra_trigger: ".o_form_view",
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_form_view_editor",
            trigger: ".o_web_studio_field_related",
            run: "drag_and_drop(.o_inner_group)",
        },
        {
            extra_trigger: ".modal-dialog",
            trigger: ".o_model_field_selector_value",
            run: "click",
        },
        {
            in_modal: false,
            extra_trigger: ".o_model_field_selector_popover",
            trigger: ".o_model_field_selector_popover_search input",
            run: "edit Related Partner",
        },
        {
            in_modal: false,
            trigger: "[data-name=partner_id] > button.o_model_field_selector_popover_item_relation",
            run: "click",
        },
        {
            in_modal: false,
            trigger: ".o_model_field_selector_popover_search input",
            run: "edit New File",
        },
        {
            in_modal: false,
            trigger:
                ".o_model_field_selector_popover_item_name:contains(New File):not(:contains(filename))",
            run: "click",
        },
        {
            trigger: ".modal-footer .btn-primary:first",
            run: "click",
        },
        {
            trigger: ".o_web_studio_leave",
            run() {},
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_test_undo_new_field", {
    test: true,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            trigger: ".o_form_view .o_form_editable",
            run: "click",
        },
        {
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_new_fields .o_web_studio_field_integer",
            run: "drag_and_drop(.o_web_studio_form_view_editor .o_web_studio_hook:eq(1))",
        },
        {
            trigger: "button.o_web_studio_undo.o_web_studio_active",
            run: "click",
        },
        {
            trigger: ".o_web_studio_leave",
            isCheck: true,
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_test_change_lone_attr_modifier_form", {
    test: true,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            extra_trigger: ".o_form_view",
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_form_view_editor",
            trigger: ".o_field_widget[name='name']",
            run: "click",
        },
        {
            extra_trigger: `.o_web_studio_sidebar input[name="required"]`,
            trigger: ".o_web_studio_sidebar",
            run() {
                const required = this.anchor.querySelector(`input[name="required"]`);
                assertEqual(required.checked, true);
            },
        },
        {
            trigger: '.o_web_studio_sidebar input[name="required"]',
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_form_view_editor:not(:has(.o_required_modifier))",
            trigger: ".o_web_studio_sidebar",
            run() {
                const required = this.anchor.querySelector(`input[name="required"]`);
                assertEqual(required.checked, false);
            },
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_test_new_field_rename_description", {
    test: true,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            extra_trigger: ".o_form_view",
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_form_view_editor",
            trigger: ".o_web_studio_sidebar .o_web_studio_component.o_web_studio_field_char",
            run: "drag_and_drop(.o_web_studio_form_view_editor .o_web_studio_hook:eq(1))",
        },
        {
            trigger: ".o_web_studio_sidebar input[name='string']",
            run: "edit my new field && click body",
        },
        {
            trigger:
                ".o_web_studio_form_view_editor label[for='x_studio_my_new_field_0']:contains(my new field)",
            isCheck: true,
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_test_edit_digits_option", {
    test: true,
    url: "/web",
    sequence: 260,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            trigger: ".o_form_view .o_form_editable",
            run: "click",
        },

        {
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_view_renderer",
            trigger: "[name=partner_latitude]",
            run: "click",
        },
        {
            trigger: "input#digits",
            run: "edit 2 && click body",
        },
        {
            trigger: ".o_web_studio_leave",
            isCheck: true,
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_no_fetch_subview", {
    test: true,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            trigger: "input#name_0",
            run: "edit value",
        },
        {
            trigger: "button.o_form_button_save",
            run: "click",
        },
        {
            extra_trigger: ".o_form_view",
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_new_fields .o_web_studio_field_many2many",
            run: "drag_and_drop(.o_web_studio_form_view_editor .o_web_studio_hook:eq(0))",
        },
        {
            trigger: ".o_record_selector input",
            run: "edit Contact",
        },
        {
            trigger: "a.dropdown-item:contains(Contact)",
            run: "click",
        },
        {
            trigger: ".modal-footer button.btn-primary",
            run: "click",
        },
        {
            trigger: ".o_wrap_field label:contains('New Many2Many')",
            isCheck: true,
        },
    ],
});

registry.category("web_tour.tours").add("web_studio.test_button_rainbow_effect", {
    test: true,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            trigger: ".o_form_view .o_form_editable",
            run: "click",
        },
        {
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: `.o_web_studio_view_renderer button[name="open_commercial_entity"]`,
            run: "click",
        },
        {
            trigger: ".o_web_studio_sidebar #effect",
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_sidebar #rainbow_message",
            trigger: ".o_web_studio_sidebar",
            run() {
                const blob = new Blob(
                    [
                        "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAF0lEQVR4nGJxKFrEwMDAxAAGgAAAAP//D+IBWx9K7TUAAAAASUVORK5CYII=",
                    ],
                    { type: "image/png" }
                );
                const file = new File([blob], "my_studio_image.png");

                const fileInput = document.querySelector(
                    ".o_web_studio_sidebar .o_file_input input"
                );
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
                fileInput.dispatchEvent(new Event("change"));
            },
        },
        {
            trigger: ".o_web_studio_sidebar img[src^='/web/content']",
            isCheck: true,
        },
    ],
});

registry.category("web_tour.tours").add("web_studio.test_res_users_fake_fields", {
    test: true,
    steps: () => [
        {
            trigger: ".o_web_studio_existing_fields_header",
            run: "click",
        },
        {
            trigger: ".o_web_studio_existing_fields",
            run() {
                const elements = [...document.querySelectorAll(".o_web_studio_component")];
                const fieldStrings = elements.map((el) => el.innerText.split("\n")[0]);
                assertEqual(fieldStrings.includes("Administration"), false);
                assertEqual(fieldStrings.includes("Multi Companies"), false);
            },
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_test_reload_after_restoring_default_view", {
    test: true,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            extra_trigger: ".o_form_view",
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_studio_form_view_editor .o_field_widget[name='name']",
            run: "click",
        },
        {
            trigger: ".o_web_studio_sidebar input[name='string']",
            run: "edit new name",
        },
        {
            trigger: ".o_web_studio_sidebar .o_web_studio_view",
            run: "click",
        },
        {
            trigger: ".o_web_studio_restore",
            run: "click",
        },
        {
            trigger: ".modal-footer .btn-primary",
            run: "click",
        },
        {
            extra_trigger: ".o_web_studio_undo:not(.o_web_studio_active)",
            trigger:
                ".o_web_studio_form_view_editor .o_field_widget[name='name'] span:contains('Name')",
            isCheck: true,
        },
    ],
});

registry.category("web_tour.tours").add("web_studio_test_edit_reified_field", {
    test: true,
    steps: () => [
        {
            trigger: "a[data-menu-xmlid='web_studio.studio_test_partner_menu']",
            run: "click",
        },
        {
            extra_trigger: ".o_form_view",
            trigger: ".o_web_studio_navbar_item button",
            run: "click",
        },
        {
            trigger: ".o_web_studio_form_view_editor .o_field_widget[name^='sel_groups_'],.o_web_studio_form_view_editor .o_field_widget[name^='in_groups_']",
            run: "click",
        },
        {
            trigger: ".o_web_studio_sidebar input[name='string']",
            run: "edit new name && click body",
        },
        {
            trigger: ".o_web_studio_leave",
            isCheck: true,
        },
    ]
});
