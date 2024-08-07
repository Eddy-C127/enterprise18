/** @odoo-module */

import { endKnowledgeTour } from './knowledge_tour_utils.js';
import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

function moveCover(position) {
    const cover = document.querySelector('.o_knowledge_cover img');
    cover.dispatchEvent(new PointerEvent('pointerdown'));
    document.dispatchEvent(new PointerEvent('pointermove', {clientY: position}));
    document.dispatchEvent(new PointerEvent('pointerup'));
}

/**
 * Tests the cover picker feature when unsplash credentials are unset. In this
 * case, the "Add Cover" button should always open the cover selector.
 */
registry.category("web_tour.tours").add("knowledge_cover_selector_tour", {
    test: true,
    url: "/odoo",
    steps: () => [
        stepUtils.showAppsMenuItem(),
        {
    // Open Knowledge App
    trigger: '.o_app[data-menu-xmlid="knowledge.knowledge_menu_root"]',
            run: "click",
        },
        {
    // Click on the "Create" button
    trigger: '.o_knowledge_header .btn-create',
            run: "click",
        },
        {
            trigger: '.o_article_active:contains("Untitled")',
        },
        {
    // Set the name of the article
    trigger: '.o_hierarchy_article_name > input',
            run: "edit Birds && click body",
        },
        {
            content: "Make the add cover button visible (only visible on hover)",
            trigger: '.o_article_active:contains("Birds")',
        },
        {
            content: "click on toggle menu",
            trigger: "#dropdown_tools_panel[title='More actions']",
            run: "click",
        },
        {
            content: "Click on add cover button",
            trigger: ".o_knowledge_add_cover",
            run: "click",
        },
        {
            trigger: ".modal-body .unsplash_error",
        },
        {
    // Check that the cover selector has been opened and that it shows
    // the form allowing to enter unsplash credentials, and click on the
    // add url button
    trigger: '.o_upload_media_url_button',
        },
        {
            trigger: ".modal-body .o_nocontent_help",
        },
        {
    // Change the search query to find odoo_logo file
    trigger: '.modal-body input.o_we_search',
            run: "edit odoo_logo",
        },
        {
    // Choose the odoo_logo cover
    trigger: '.o_existing_attachment_cell img[title*="odoo_logo"]',
            run: "click",
        },
        {
    // Check cover has been added to the article and is initially centered and
    // make the reposition cover button visible
    trigger: '.o_knowledge_cover img[style="object-position: 50% 50%;"]',
        },
        {
            content: "Click on the reposition cover button",
            trigger: ".o_knowledge_reposition_cover",
            run: "click",
        },
        {
    // Move the cover down and click on the "Cancel" button
    trigger: '.o_reposition_hint',
    run: () => {
        moveCover(1000);
        const undoButton = document.querySelector('.o_knowledge_undo_cover_move');
        // Timeout to make sure the event is fired after that the cover has moved
        setTimeout(() => undoButton.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true})), 0);
    },
        },
        {
            trigger: ".o_knowledge_cover:not(:has(.o_reposition_hint))",
        },
        {
    // Check that the undo button works as expected (cover should be centered)
    trigger: '.o_knowledge_cover img[style="object-position: 50% 50%;"]',
        },
        {
            content: "Move cover again but use the 'save' button this time",
            trigger: ".o_knowledge_reposition_cover",
            run: "click",
        },
        {
    trigger: '.o_reposition_hint',
    run: () => {
        moveCover(1000);
        const saveButton = document.querySelector('.o_knowledge_save_cover_move');
        // Timeout to make sure the event is fired after that the cover has moved
        setTimeout(() => saveButton.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true})), 0);
    }
        },
        {
            trigger: ".o_knowledge_cover:not(:has(.o_reposition_hint))",
        },
        {
    // Check that the cover is positioned at the top
    trigger: '.o_knowledge_cover img[style="object-position: 50% 0.01%;"]',
            run: "click",
        },
        {
    // Create another article
    trigger: '.o_knowledge_header .btn-create',
            run: "click",
        },
        {
            trigger: '.o_article_active:contains("Untitled")',
        },
        {
    // Change the name of the article
    trigger: '.o_hierarchy_article_name > input',
            run: "edit odoo && click body",
        },
        {
            trigger: '.o_article_active:contains("odoo")',
        },
        {
    // Go back to previous article
    trigger: '.o_knowledge_sidebar .o_article_name:contains("Birds")',
            run: "click",
        },
        {
            trigger: '.o_article_active:contains("Birds")',
        },
        {
    // Check that the cover is still positioned at the top and make the replace
    // cover visible
    trigger: '.o_knowledge_cover img[style="object-position: 50% 0.01%;"]',
        },
        {
            content: "Click on replace cover button",
            trigger: ".o_knowledge_replace_cover",
            run: "click",
        },
        {
            trigger: ".modal-body .o_nocontent_help",
        },
        {
    // Check that the cover selector has been opened, that no image is shown
    // since the search query (birds) do not match the name of the existing
    // cover, and close the cover selector
    trigger: '.modal-footer .btn-secondary',
            run: "click",
        },
        {
    // Make the remove cover button visible
    trigger: '.o_knowledge_edit_cover_buttons',
        },
        {
            content: "Click on remove cover button",
            trigger: ".o_knowledge_remove_cover",
            run: "click",
        },
        {
            trigger: ".o_knowledge_body:not(:has(.o_widget_knowledge_cover))",
        },
        {
    // Check cover has been removed from the article and open other article
    trigger: '.o_knowledge_sidebar .o_article_name:contains("odoo")',
            run: "click",
        },
        {
    // Make the add cover button visible
    trigger: '.o_article_active:contains("odoo")',
        },
        {
            content: "click on toggle menu",
            trigger: "#dropdown_tools_panel[title='More actions']",
            run: "click",
        },
        {
            content: "Click on add cover button",
            trigger: ".o_knowledge_add_cover",
            run: "click",
        },
        {
    // Check that odoo logo previously uploaded is shown in the selector as the
    // search query, which is the article name, is "odoo" which is also in the
    // cover attachment's name, and that clicking on it sets it as cover of the
    // current article
    trigger: '.modal-body .o_existing_attachment_cell img[title="odoo_logo.png"]',
            run: "click",
        },
        {
            trigger: ".o_knowledge_cover",
        },
        {
    // Check cover has been set, and open previous article again
    trigger: '.o_knowledge_sidebar .o_article_name:contains("Birds")',
            run: "click",
        },
        {
    // Make the add cover button visible
    trigger: '.o_knowledge_edit_cover_buttons',
        },
        {
            content: "click on toggle menu",
            trigger: "#dropdown_tools_panel[title='More actions']",
            run: "click",
        },
        {
            content: "Click on add cover button",
            trigger: ".o_knowledge_add_cover",
            run: "click",
        },
        {
            trigger: ".modal-body .o_nocontent_help",
        },
        {
    // Check odoo logo is not shown as the search query does not match its name
    // and remove search query
    trigger: '.modal-body input.o_we_search',
            run: "clear",
        },
        {
    // Check that odoo logo is now shown in the cover selector, and make the trash
    // button visible
    trigger: '.modal-body .o_existing_attachment_cell img[title="odoo_logo.png"]',
        },
        {
            content: "Click on delete cover button",
            trigger:
                '.modal-body .o_existing_attachment_cell:has(img[title="odoo_logo.png"]) .o_existing_attachment_remove',
            run: "click",
        },
        {
            trigger: '.modal-title:contains("Confirmation")',
        },
        {
    // Confirm deletion of cover (should ask for confirmation)
    trigger: '.modal-footer .btn-primary',
            run: "click",
        },
        {
            trigger:
                ".modal-body .o_we_existing_attachments:not(:has(.o_existing_attachment_cell))",
        },
        {
    // Check that no cover is shown anymore in the cover selector, and close it
    trigger: '.modal-footer .btn-secondary',
            run: "click",
        },
        {
    // Open other article to check that its cover has been removed since it has
    // been deleted
    trigger: '.o_knowledge_sidebar .o_article_name:contains("odoo")',
            run: "click",
        },
        {
            trigger: '.o_article_active:contains("odoo")',
        },
        {
            trigger: ".o_knowledge_body:not(:has(.o_widget_knowledge_cover))",
        },
        ...endKnowledgeTour(),
    ],
});
