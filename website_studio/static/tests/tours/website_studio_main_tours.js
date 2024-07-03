/** @odoo-module */

import { registry } from "@web/core/registry";
import { assertEqual } from "@web_studio/../tests/tours/tour_helpers";

registry.category("web_tour.tours").add("website_studio_listing_and_page", {
    url: "/web?debug=1#action=studio&mode=home_menu",
    test: true,
    steps: () => [
        {
            trigger: "a.o_menuitem:contains('StudioApp')",
            run: "click",
        },
        {
            trigger: ".o_menu_sections a:contains('Website')",
            run: "click",
        },
        {
            trigger: ".o_website_studio_listing",
            run: "click",
        },
        {
            content: "Create a listing page",
            trigger: ".o_website_studio_listing .o_web_studio_thumbnail_item",
            run: "click",
        },
        {
            content: "Set the name of the page",
            trigger: "div[name='page_name'] input",
            run: "edit MyCustom Name && click body",
        },
        {
            trigger: "div[name='name_slugified']",
            run: () => {
                assertEqual(document.querySelector( "div[name='name_slugified']").textContent, "mycustom-name");
                // listing is displayed in the menu by default
                assertEqual(document.querySelector("div[name='use_menu'] input").checked, true);
                // creating a listing automatically creates a detailed page for each record to be consulted separately
                assertEqual(document.querySelector("div[name='auto_single_page'] input").checked, true);
            }
        },
        {
            trigger: ".modal:not(.o_inactive_modal) .o_form_button_save",
            in_modal: false,
            run: "click",
        },
        {
            trigger: "body:not(:has(.modal))",
            run: () => {
                const listingCount = [...document.querySelectorAll(".o_website_studio_listing .o_web_studio_thumbnail_item:not(.o_website_studio_new_card)")].length;
                assertEqual(listingCount, 1);
                const pagesCount = [...document.querySelectorAll(".o_website_studio_single .o_web_studio_thumbnail_item:not(.o_website_studio_new_card)")].length;
                assertEqual(pagesCount, 1);
                // the listing has the right name
                assertEqual(document.querySelector(".o_website_studio_listing .o_web_studio_thumbnail_item:not(.o_website_studio_new_card)").textContent, "MyCustom Name");
                // the page has the right name
                assertEqual(document.querySelector(".o_website_studio_single .o_web_studio_thumbnail_item:not(.o_website_studio_new_card)").textContent, "MyCustom Name");
            }
        },
    ],
});

registry.category("web_tour.tours").add("website_studio_listing_without_page", {
    url: "/web?debug=1#action=studio&mode=home_menu",
    test: true,
    steps: () => [
        {
            trigger: "a.o_menuitem:contains('StudioApp')",
            run: "click",
        },
        {
            trigger: ".o_menu_sections a:contains('Website')",
            run: "click",
        },
        {
            trigger: ".o_website_studio_listing",
            run: "click",
        },
        {
            content: "Create a listing page",
            trigger: ".o_website_studio_listing .fa-plus",
            run: "click",
        },
        {
            content: "Set the name of the page",
            trigger: "div[name='page_name'] input",
            run: "edit MyCustom Name && click body",
        },
        {
            trigger: "div[name='name_slugified']",
            run: () => {
                assertEqual(document.querySelector( "div[name='name_slugified']").textContent, "mycustom-name");
                // listing is displayed in the menu by default
                assertEqual(document.querySelector("div[name='use_menu'] input").checked, true);
                // creating a listing automatically creates a detailed page for each record to be consulted separately
                assertEqual(document.querySelector("div[name='auto_single_page'] input").checked, true);
            }
        },
        {
            content: "Uncheck the toggle and only create the listing",
            trigger: ".modal:not(.o_inactive_modal) div[name='auto_single_page'] input",
            in_modal: false,
            run: "click",
        },
        {
            trigger: ".modal:not(.o_inactive_modal) .o_form_button_save",
            in_modal: false,
            run: "click",
        },
        {
            trigger: "body:not(:has(.modal))",
            run: () => {
                const listingCount = [...document.querySelectorAll(".o_website_studio_listing .o_web_studio_thumbnail_item:not(.o_website_studio_new_card)")].length;
                assertEqual(listingCount, 1);
                const pagesCount = [...document.querySelectorAll(".o_website_studio_single .o_web_studio_thumbnail_item:not(.o_website_studio_new_card)")].length;
                assertEqual(pagesCount, 0);
                // the listing has the right name
                assertEqual(document.querySelector(".o_website_studio_listing .o_web_studio_thumbnail_item:not(.o_website_studio_new_card)").textContent, "MyCustom Name");
            }
        },
    ],
});
