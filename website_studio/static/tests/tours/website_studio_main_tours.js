/** @odoo-module */

import { registry } from "@web/core/registry";
import { assertEqual } from "@web_studio/../tests/tours/tour_helpers";

registry.category("web_tour.tours").add("website_studio_listing_and_page", {
    url: "/odoo/action-studio?debug=1&mode=home_menu",
    test: true,
    steps: () => [
        {
            trigger: "a.o_menuitem:contains('StudioApp')",
            run: "click",
        },
        {
            trigger: ".o_menu_sections a:contains('Model Pages')",
            run: "click",
        },
        {
            content: "Create a listing page",
            trigger: ".o-kanban-button-new",
            run: "click",
        },
        {
            content: "Set the name of the page",
            trigger: "div[name='name'] input",
            run: "edit MyCustom Name && press Tab",
        },
        {
            trigger: "div[name='name_slugified'] input:value(mycustom-name)",
        },
        {
            content: "listing is displayed in the menu by default",
            trigger: "div[name='use_menu'] input:checked",
        },
        {
            content:
                "creating a listing automatically creates a detailed page for each record to be consulted separately",
            trigger: "div[name='auto_single_page'] input:checked",
        },
        {
            trigger: ".o_form_button_save",
            run: "click",
        },
        {
            trigger: ".o_back_button",
            run: "click",
        },
        {
            trigger: ".o_kanban_view",
            run() {
                const pages = this.anchor.querySelectorAll(".o_kanban_record:not(.o_kanban_ghost)");
                assertEqual(pages.length, 1);
                assertEqual(pages[0].querySelector("[data-section='title']").textContent, "MyCustom Name");
            },
        },
    ],
});

registry.category("web_tour.tours").add("website_studio_listing_without_page", {
    url: "/odoo/action-studio?debug=1&mode=home_menu",
    test: true,
    steps: () => [
        {
            trigger: "a.o_menuitem:contains('StudioApp')",
            run: "click",
        },
        {
            trigger: ".o_menu_sections a:contains('Model Pages')",
            run: "click",
        },
        {
            content: "Create a listing page",
            trigger: ".o-kanban-button-new",
            run: "click",
        },
        {
            content: "Set the name of the page",
            trigger: "div[name='name'] input",
            run: "edit MyCustom Name && press Tab",
        },
        {
            trigger: "div[name='name_slugified'] input:value(mycustom-name)",
        },
        {
            content: "listing is displayed in the menu by default",
            trigger: "div[name='use_menu'] input:checked",
        },
        {
            content:
                "creating a listing automatically creates a detailed page for each record to be consulted separately",
            trigger: "div[name='auto_single_page'] input:checked",
        },
        {
            content: "Uncheck the toggle and only create the listing",
            trigger: "div[name='auto_single_page'] input",
            run: "click",
        },
        {
            trigger: ".o_form_button_save",
            run: "click",
        },
        {
            trigger: ".o_back_button",
            run: "click",
        },
        {
            trigger: ".o_kanban_view",
            run() {
                const pages = this.anchor.querySelectorAll(".o_kanban_record:not(.o_kanban_ghost)");
                assertEqual(pages.length, 1);
                assertEqual(pages[0].querySelector("[data-section='title']").textContent, "MyCustom Name");
            },
        },
    ],
});
