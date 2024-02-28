/** @odoo-module */

import { Component, xml } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { patch } from "@web/core/utils/patch";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

import { endKnowledgeTour } from '../knowledge_tour_utils.js';
import { VideoBehavior } from "@knowledge/components/behaviors/video_behavior/video_behavior";

import { VideoSelector } from "@web_editor/components/media_dialog/video_selector";

//------------------------------------------------------------------------------
// UTILS
//------------------------------------------------------------------------------

const embedViewSelector = (embedViewName) => {
    return `.o_knowledge_embedded_view:contains("${embedViewName}")`;
};

// This tour follows the 'knowledge_article_commands_tour'.
// As it contains a video, we re-use the Mock to avoid relying on actual YouTube content
let unpatchVideoBehavior;
let unpatchVideoSelector;

class MockedVideoIframe extends Component {
    static template = xml`
        <div class="o_video_iframe_src" t-out="props.src" />
    `;
    static props = ["src"];
}

const videoPatchSteps = [{ // patch the components
    trigger: "body",
    run: () => {
        unpatchVideoBehavior = patch(VideoBehavior.components, {
            ...VideoBehavior.components,
            VideoIframe: MockedVideoIframe
        });
        unpatchVideoSelector = patch(VideoSelector.components, {
            ...VideoSelector.components,
            VideoIframe: MockedVideoIframe
        });
    },
}];

const videoUnpatchSteps = [{ // unpatch the components
    trigger: "body",
    run: () => {
        unpatchVideoBehavior();
        unpatchVideoSelector();
    },
}];

//------------------------------------------------------------------------------
// TOUR STEPS - KNOWLEDGE COMMANDS
//------------------------------------------------------------------------------

/*
 * EMBED VIEW: /list
 * Checks that a user that has readonly access on an article cannot create items from the item list.
 * Note: this tour follows the 'knowledge_article_commands_tour', so we re-use the list name.
 */
const embedListName = "List special chars *()!'<>~";
const embedListSteps = [{ // scroll to the embedded view to load it
    trigger: embedViewSelector(embedListName),
    run: function () {
        this.anchor.scrollIntoView();
    },
}, { // wait for the list view to be mounted
    trigger: `${embedViewSelector(embedListName)} .o_list_renderer`,
    run: () => {},
}, { // check that the "new" button is not shown
    trigger: `${embedViewSelector(embedListName)} .o_control_panel_main:not(:has(.o_list_button_add))`,
    run: () => {},
}];

/*
 * EMBED VIEW: /kanban
 * Checks that a user that has readonly access on an article cannot create items from the item kanban.
 * Note: this tour follows the 'knowledge_article_commands_tour', so we re-use the kanban name.
 */
const embedKanbanName = "My Tasks Kanban";
const embedKanbanSteps = [{ // scroll to the embedded view to load it
    trigger: embedViewSelector(embedKanbanName),
    run: function () {
        this.anchor.scrollIntoView();
    },
}, { // wait for the kanban view to be mounted
    trigger: `${embedViewSelector(embedKanbanName)} .o_kanban_renderer`,
    run: () => {},
}, { // check that the "new" button is not shown
    trigger: `${embedViewSelector(embedKanbanName)} .o_control_panel_main:not(:has(.o-kanban-button-new))`,
    run: () => {},
}];

registry.category("web_tour.tours").add('knowledge_article_commands_readonly_tour', {
    url: '/web',
    test: true,
    steps: () => [stepUtils.showAppsMenuItem(), {
    // open the Knowledge App
    trigger: '.o_app[data-menu-xmlid="knowledge.knowledge_menu_root"]',
},
    ...videoPatchSteps,
    ...embedListSteps,
    ...embedKanbanSteps,
    ...videoUnpatchSteps,
    ...endKnowledgeTour()
]});
