/** @odoo-module */

import { Component, markup, xml } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { patch } from "@web/core/utils/patch";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

import { appendArticleLink, endKnowledgeTour, openCommandBar } from '../knowledge_tour_utils.js';
import { VideoBehavior } from "@knowledge/components/behaviors/video_behavior/video_behavior";
import { decodeDataBehaviorProps } from "@knowledge/js/knowledge_utils";

import { VideoSelector } from "@web_editor/components/media_dialog/video_selector";
import { setSelection } from '@web_editor/js/editor/odoo-editor/src/utils/utils';

/**
 * This is a global knowledge tour testing commands and their usage.
 * 
 * If you need to edit this tour, here are a few recommendations:
 * - Try to keep the steps light and test specifically your command
 * - Keep the commands modifying the main article at the top
 * - Ideally, those commands should NOT leave this article, and just modify its content
 * - Embed view commands are grouped together right after the other commands
 * - If you need to test something that leaves the article to test your command usage
 *   (go into another menu, switch article, ...), it's better to put it after everything else,
 *   in the "MISC" section.
 *   Indeed, trying to input commands when rapidly switching from another view / article can create
 *   some race conditions with the editor, leading to hard-to-debug issues
 *   (e.g: "Component is destroyed").
 */

//------------------------------------------------------------------------------
// UTILS
//------------------------------------------------------------------------------

const embedViewSelector = (embedViewName) => {
    return `.o_knowledge_embedded_view:contains("${embedViewName}")`;
};

const commonKanbanSteps = (embedViewName) => {
    return [
        { // scroll to the embedded view to load it
            trigger: embedViewSelector(embedViewName),
            run: function () {
                this.anchor.scrollIntoView();
            },
        }, { // wait for the kanban view to be mounted
            trigger: `${embedViewSelector(embedViewName)} .o_kanban_renderer`,
            run: () => {},
        },
    ];
};

//------------------------------------------------------------------------------
// TOUR STEPS - KNOWLEDGE COMMANDS
//------------------------------------------------------------------------------

// COMMAND: /article

const articleCommandSteps = [
    ...appendArticleLink('[name="body"]', "LinkedArticle"),
];

// COMMAND: /file

const fileCommandSteps = [{ // open the command bar
    trigger: '.odoo-editor-editable > p',
    run: function () {
        openCommandBar(this.anchor);
    },
}, { // click on the /file command
    trigger: '.oe-powerbox-commandName:contains("File")',
    run: 'click',
}, { // wait for the media dialog to open
    trigger: '.o_select_media_dialog',
}, { // click on the first item of the modal
    trigger: '.o_existing_attachment_cell:contains(Onboarding)',
    run: 'click'
}, { // wait for the block to appear in the editor
    trigger: '.o_knowledge_behavior_type_file a.o_image',
    run: 'click',
}, {
    trigger: '.o-FileViewer-headerButton[aria-label="Close"]',
    extra_trigger: 'iframe.o-FileViewer-view body:contains(Content)',
    run: 'click',
}, {
    trigger: '.o_knowledge_file_name_container:contains(Onboarding)',
    run: function() {
        this.anchor.dispatchEvent(new Event("focus"));
    }
}, {
    trigger: 'input[placeholder="Onboarding.txt"]',
    run: function (helpers) {
        helpers.text("Renamed");
        this.anchor.dispatchEvent(new Event("blur"));
    }
}, {
    trigger: 'span.o_knowledge_file_name',
    run: function () {
        // specifically test that there is no zeroWidthSpace character in the
        // name that would be added by the editor
        const currentName = this.anchor.textContent;
        if (currentName !== "Renamed") {
            throw new Error(`The new file name was expected to be: "Renamed", but the actual value is: "${currentName}"`);
        }
    }
}];

// COMMAND: /index

const indexCommandSteps = [{ // open the command bar
    trigger: '.odoo-editor-editable > p',
    run: function () {
        openCommandBar(this.anchor);
    },
}, { // click on the /index command
    trigger: '.oe-powerbox-commandName:contains("Index")',
    run: 'click',
}, { // wait for the block to appear in the editor
    trigger: '.o_knowledge_behavior_type_articles_structure',
}, { // click on the refresh button
    trigger: '.o_knowledge_behavior_type_articles_structure button[title="Update"]',
    run: 'click',
}, { // click on the switch mode button
    trigger: '.o_knowledge_behavior_type_articles_structure button[title="Switch Mode"]',
    run: 'click',
}];

// COMMAND: /toc (table of contents)

const tocCommandSteps = [{ // open the command bar
    trigger: '.odoo-editor-editable > p',
    run: function () {
        openCommandBar(this.anchor);
    },
}, { // click on the /toc command
    trigger: '.oe-powerbox-commandName:contains("Table Of Content")',
    run: 'click',
}, { // wait for the block to appear in the editor
    trigger: '.o_knowledge_behavior_type_toc',
}, { // insert a few titles in the editor
    trigger: '.odoo-editor-editable > p',
    run: function () {
        const toCreate = [
            ["h1", "Title 1"],
            ["h2", "Title 1.1"],
            ["h3", "Title 1.1.1"],
            ["h2", "Title 1.2"],
        ];
        toCreate.forEach((el) => {
            const elem = document.createElement(el[0]);
            elem.textContent = el[1];
            this.anchor.appendChild(elem);
        })
    },
}, { // click on the h1 anchor link generated by the toc
    trigger: '.o_knowledge_toc_link_depth_0',
    run: 'click',
}, { // open the tools panel
    trigger: '#dropdown_tools_panel',
    run: 'click',
}, { // switch to locked (readonly) mode
    trigger: '.o_knowledge_more_options_panel .btn-lock',
    run: 'click',
}, { // check that we are in readonly mode
    trigger: '.o_field_html .o_readonly',
    run: () => {},
}, { // check that the content of the toc is not duplicated
    trigger: '.o_knowledge_behavior_type_toc',
    run: function () {
        if (this.anchor.querySelectorAll(".o_knowledge_toc_content").length !== 1) {
            throw new Error('The table of content group of links should be present exactly once (not duplicated)');
        }
    },
}, { // click on the h1 anchor link generated by the toc
    trigger: '.o_knowledge_toc_link_depth_0',
    run: 'click',
}, { // open the tools panel
    trigger: '#dropdown_tools_panel',
    run: 'click',
}, { // unlock the article
    trigger: '.o_knowledge_more_options_panel.show .btn-lock',
    run: 'click',
}, { // check that we are in edit mode
    trigger: '.o_field_html .odoo-editor-editable',
    run: () => {},
}];

// COMMAND: /clipboard

const clipboardCommandSteps = [{ // go to the custom article
    trigger: '.o_article .o_article_name:contains("EditorCommandsArticle")',
}, { // wait for article to be correctly loaded
    trigger: '.o_breadcrumb_article_name_container:contains("EditorCommandsArticle")',
    run: () => {},
}, { // open the command bar
    trigger: '.odoo-editor-editable > p',
    run: function () {
        openCommandBar(this.anchor);
    },
}, { // click on the /clipboard command
    trigger: '.oe-powerbox-commandName:contains("Clipboard")',
    run: 'click',
}, { // wait for the block to appear in the editor
    trigger: '.o_knowledge_behavior_type_template',
    run: () => {},
}, { // enter text into the clipboard template
    trigger: '.o_knowledge_content > p',
    run: 'text Hello world'
}, { // verify that the text was correctly inserted
    trigger: '.o_knowledge_content > p:contains(Hello world)',
}];

// COMMAND: /video

const YoutubeVideoId = "Rk1MYMPDx3s";
let unpatchVideoBehavior;
let unpatchVideoSelector;

class MockedVideoIframe extends Component {
    static template = xml`
        <div class="o_video_iframe_src" t-out="props.src" />
    `;
    static props = ["src"];
}

const videoCommandSteps = [{ // patch the components
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
}, { // open the command bar
    trigger: ".odoo-editor-editable > p",
    run: function () {
        openCommandBar(this.anchor);
    },
}, { // click on the /video command
    trigger: '.oe-powerbox-commandName:contains("Video")',
    run: "click",
}, {
    content: "Enter a video URL",
    trigger: ".modal-body #o_video_text",
    run: `text https://www.youtube.com/watch?v=${YoutubeVideoId}`,
}, {
    content: "Wait for preview to appear",
    trigger: `.o_video_iframe_src:contains("//www.youtube.com/embed/${YoutubeVideoId}?rel=0&autoplay=0")`,
    run: () => {},
}, {
    content: "Confirm selection",
    trigger: '.modal-footer button:contains("Insert Video")',
}, { // wait for the block to appear in the editor
    trigger: ".o_knowledge_behavior_type_video",
    extra_trigger: `.o_knowledge_behavior_type_video .o_video_iframe_src:contains("https://www.youtube.com/embed/${YoutubeVideoId}?rel=0&autoplay=0")`
}];

const videoUnpatchSteps = [{ // unpatch the components
    trigger: "body",
    run: () => {
        unpatchVideoBehavior();
        unpatchVideoSelector();
    },
}];

//------------------------------------------------------------------------------
// TOUR STEPS - KNOWLEDGE EMBED VIEWS
//------------------------------------------------------------------------------

// EMBED VIEW: /list

let behaviorProps;
const embedListName = "List special chars *()!'<>~";
const listCommandSteps = [{ // open the command bar
    trigger: '.odoo-editor-editable > p',
    run: function () {
        openCommandBar(this.anchor);
    },
}, { // click on the /list command
    trigger: '.oe-powerbox-commandName:contains("Item List")',
    run: 'click',
}, { // input a test name for the view
    trigger: '.modal-dialog #label',
    run: `text ${embedListName}`,
}, { // choose a name for the embedded view
    trigger: '.modal-footer button.btn-primary',
    run: 'click'
}, { // scroll to the embedded view to load it
    trigger: embedViewSelector(embedListName),
    run: function () {
        this.anchor.scrollIntoView();
    },
}, { // wait for the list view to be mounted
    trigger: `${embedViewSelector(embedListName)} .o_list_renderer`,
    run: () => {},
}, { // verify that the view has the correct name and store data-behavior-props
    trigger: `${embedViewSelector(embedListName)} .o_control_panel .o_breadcrumb .active:contains("*()!'<>~")`,
    run: () => {
        const embeddedViewElement = document.querySelector('.o_knowledge_behavior_type_embedded_view');
        behaviorProps = decodeDataBehaviorProps(embeddedViewElement.dataset.behaviorProps);
    }
}, { // click on rename button
    trigger: '.o_control_panel_breadcrumbs_actions .dropdown-toggle',
    run: 'click',
}, {
    trigger: '.dropdown-item:contains(Edit)'
}, { // click to validate the modal
    trigger: '.modal-footer button.btn-primary',
    run: 'click'
}, { // check that the name is the correct one and compare previous data-behavior-props and the new one (should be equivalent)
    trigger: `${embedViewSelector(embedListName)} .o_control_panel .o_breadcrumb .active:contains("*()!'<>~")`,
    run: () => {
        const embeddedViewElement = document.querySelector('.o_knowledge_behavior_type_embedded_view');
        const newBehaviorProps = decodeDataBehaviorProps(embeddedViewElement.dataset.behaviorProps);
        if (newBehaviorProps.display_name !== behaviorProps.display_name) {
            throw new Error('The name displayed should not have changed');
        }
        if (JSON.stringify(newBehaviorProps) !== JSON.stringify(behaviorProps)) {
            // check that knowledge.article render_embedded_view urllib.parse.quote did
            // produce an equivalent data-behavior-props as knowledge_utils encodeDataBehaviorProps encodeURIComponent
            throw new Error('data-behavior-props should be semantically the same as before');
        }
    }
}, { // click on rename button
    trigger: '.o_control_panel_breadcrumbs_actions .dropdown-toggle',
    run: 'click',
}, {
    trigger: '.dropdown-item:contains(Edit)'
}, { // rename the view
    trigger: '.modal-body input',
    run: 'text New Title',
}, { // click to validate the modal
    trigger: '.modal-footer button.btn-primary',
    run: 'click',
}, { // check that name has been updated
    trigger: '.o_knowledge_embedded_view .o_control_panel .o_breadcrumb .active:contains("New Title")',
    run: () => {},
}];

// EMBED VIEW: /kanban

const embedKanbanName = "My Tasks Kanban";
const embedKanbanSteps = [{ // open the command bar
    trigger: '.odoo-editor-editable > p',
    run: function () {
        openCommandBar(this.anchor);
    },
}, { // click on the /kanban command
    trigger: '.oe-powerbox-commandName:contains("Item Kanban")',
    run: 'click',
}, { // input a test name for the view
    trigger: '.modal-dialog #label',
    run: `text ${embedKanbanName}`,
}, { // choose a name for the embedded view
    trigger: `.modal-dialog:contains("Insert a Kanban View") .modal-footer button.btn-primary`,
    run: 'click',
},
...commonKanbanSteps(embedKanbanName),
{ // Check that the stages are well created
    trigger: `${embedViewSelector(embedKanbanName)} .o_kanban_renderer .o_kanban_group .o_kanban_header_title:contains("Ongoing")`,
    run: () => {},
}, { // create an article item from Main New button
    trigger: `${embedViewSelector(embedKanbanName)} .o-kanban-button-new`,
    run: 'click',
}, { // Type a Title for new article in the quick create form
    trigger: `${embedViewSelector(embedKanbanName)} .o_kanban_renderer .o_kanban_quick_create .o_input`,
    run: 'text New Quick Create Item',
}, { // Add a random icon to the new article in the quick create form
    trigger: `${embedViewSelector(embedKanbanName)} .o_kanban_renderer .o_kanban_quick_create a[title="Add a random icon"]`,
    run: 'click',
}, { // Click on the icon to open the emoji picker and select another icon in the quick create form
    trigger: `${embedViewSelector(embedKanbanName)} .o_kanban_renderer .o_kanban_quick_create .o_article_emoji`,
    run: 'click',
}, { // Select an emoji for the new article
    trigger: '.o-Emoji[data-codepoints="🙃"]',
    run: 'click',
}, { // Click on Add to create the article
    trigger: `${embedViewSelector(embedKanbanName)} .o_kanban_renderer .o_kanban_quick_create .o_kanban_add`,
    run: 'click'
}, { // Verify that the article has been properly created
    trigger: `${embedViewSelector(embedKanbanName)} .o_kanban_renderer .o_kanban_record_title span:contains("New Quick Create Item")`,
    extra_trigger: `${embedViewSelector(embedKanbanName)} .o_kanban_renderer .o_kanban_record_title .o_article_emoji:contains("🙃")`,
    run: () => {},
}, { // Click on the icon of the created article to open the emoji picker
    trigger: `${embedViewSelector(embedKanbanName)} .o_kanban_renderer .o_kanban_record_title .o_article_emoji`,
    run: 'click',
}, { // Select another emoji for the created article
    trigger: '.o-Emoji[data-codepoints="🤩"]',
    run: 'click',
}];

// EMBED VIEW: /cards (same as kanban, without the custom stages)

const embedCardsKanbanName = "My Cards Kanban";
const embedCardsKanbanSteps = [{ // open the command bar
    trigger: '.odoo-editor-editable > p',
    run: function () {
        openCommandBar(this.anchor);
    },
}, { // click on the /kanban command
    trigger: '.oe-powerbox-commandName:contains("Item Cards")',
    run: 'click',
}, { // input a test name for the view
    trigger: '.modal-dialog #label',
    run: `text ${embedCardsKanbanName}`,
}, { // choose a name for the embedded view
    trigger: `.modal-dialog:contains("Insert a Kanban View") .modal-footer button.btn-primary`,
    run: 'click',
},
...commonKanbanSteps(embedCardsKanbanName)];

/*
 * EMBED VIEW: /kanban - with custom act_window
 * Allows testing that we support a fully custom act.window definition to create embed views.
 */

const embedKanbanActWindowName = "Act Window Kanban";
const articleItemsKanbanAction = {
    domain: "[('parent_id', '=', active_id), ('is_article_item', '=', True)]",
    help: markup('<p class="o_nocontent_help">No data to display</p>'),
    name: embedKanbanActWindowName,
    res_model: 'knowledge.article',
    type: 'ir.actions.act_window',
    views: [[false, 'kanban']],
    view_mode: 'kanban',
};

const articleItemsKanbanActionContext = (wysiwyg) => {
    return {
        active_id: wysiwyg.options.recordInfo.res_id,
        default_parent_id: wysiwyg.options.recordInfo.res_id,
        default_is_article_item: true,
    };
};

const embedKanbanActWindowSteps = [{ // manually insert view from act_window object
    trigger: '.odoo-editor-editable > p',
    run: function () {
        const wysiwyg = $(this.anchor.closest('.odoo-editor-editable')).data('wysiwyg');
        const context = articleItemsKanbanActionContext(wysiwyg);
        const restoreSelection = () => {
            return setSelection(this.anchor);
        };
        wysiwyg._insertEmbeddedView(
            undefined,
            articleItemsKanbanAction,
            "kanban",
            articleItemsKanbanAction.name,
            restoreSelection,
            context
        );
    },
},
...commonKanbanSteps(embedKanbanActWindowName)];

//------------------------------------------------------------------------------
// TOUR STEPS - MISC
//------------------------------------------------------------------------------

/*
 * MISC: Verifying view filtering mechanics.
 * When you enable a filter on an embed view, it it saved and restored if you go back to that view.
 * See: 'knowledgeEmbedViewsFilters' for more details
 */

const embedViewFiltersSteps = [{
    // Check that we have 2 elements in the embedded view
    trigger: 'tbody tr.o_data_row:nth-child(2)',
    run: () => {}
}, { // add a simple filter
    trigger: '.o_searchview_input_container input',
    run: 'text 1'
}, {
    trigger: 'li#1'
}, { // Check that the filter is effective
    trigger: 'tbody:not(tr.o_data_row:nth-child(2))',
    run: () => {}
}, { // Open the filtered article
    trigger: 'tbody > tr > td[name="display_name"]'
}, { // Wait for the article to be open
    trigger: '.o_breadcrumb_article_name_container > span:contains("Child 1")',
    run: () => {}
}, { // Open parent via the sidebar
    trigger: '.o_article_name:contains("EditorCommandsArticle")'
}, { // Check that there is no filter in the searchBar
    trigger: '.o_searchview_input_container:not( > div)',
    run: () => {}
}, { // Check that we have 2 elements in the embedded view
    trigger: 'tbody tr.o_data_row:nth-child(2)',
    run: () => {}
}, { // Go back via the breadcrumb
    trigger: '.o_back_button'
}, { // Check that there is the filter in the searchBar
    trigger: '.o_searchview_input_container > div',
    run: () => {}
}, { // Check that the filter is effective
    trigger: 'tbody:not(tr.o_data_row:nth-child(2))',
    run: () => {}
}];

// MISC: Test opening an article item through the kanban view

const embedKanbanEditArticleSteps = [{ // Create a new article using quick create in OnGoing Column
    trigger: `${embedViewSelector(embedKanbanName)} .o_kanban_renderer .o_kanban_group .o_kanban_header_title:contains("Ongoing") .o_kanban_quick_add`,
    run: 'click'
}, { // Type a Title for new article in the quick create form
    trigger: `${embedViewSelector(embedKanbanName)} .o_kanban_renderer .o_kanban_group:has(.o_kanban_header_title:contains("Ongoing")) .o_kanban_quick_create .o_input`,
    run: 'text Quick Create Ongoing Item',
}, { // Click on Edit to open the article in edition in his own form view
    trigger: `${embedViewSelector(embedKanbanName)} .o_kanban_renderer .o_kanban_quick_create .o_kanban_edit`,
    run: 'click'
}, { // verify that the view switched to the article item
    trigger: '.o_knowledge_header .o_breadcrumb_article_name_container:contains("Quick Create Ongoing Item")',
    run: () => {},
}, { // Go back via the breadcrumb
    trigger: '.o_back_button'
}, { // Wait for the article to be properly loaded
    trigger: '.odoo-editor-editable:contains("EditorCommandsArticle Content")',
    run: () => {}
}];

/*
 * MISC: Verifying /article command inside the mail composer.
 * We add specific code to make the /article command work inside the composer, notably in relation
 * to the "to inline" process.
 * See '_toInline' knowledge override in html_field.js
 */

const composeBody = '.modal-dialog:contains(Compose Email) [name="body"]';
const articleCommandComposerSteps = [{ // open the chatter
    trigger: '.btn-chatter',
}, { // open the message editor
    trigger: '.o-mail-Chatter-sendMessage:not([disabled=""])',
}, { // open the full composer
    trigger: "button[aria-label='Full composer']",
}, ...appendArticleLink(`${composeBody}`, 'EditorCommandsArticle'), { // wait for the block to appear in the editor
    trigger: `${composeBody} .o_knowledge_behavior_type_article:contains("EditorCommandsArticle")`,
    run: () => {},
}, ...appendArticleLink(`${composeBody}`, 'LinkedArticle', 1), { // wait for the block to appear in the editor, after the previous one
    trigger: `${composeBody} .odoo-editor-editable > p > a:nth-child(2).o_knowledge_behavior_type_article:contains("LinkedArticle")[contenteditable="false"]`,
    run: () => {},
}, { // verify that the first block is still there and contenteditable=false
    trigger: `${composeBody} .odoo-editor-editable > p > a:nth-child(1).o_knowledge_behavior_type_article:contains("EditorCommandsArticle")[contenteditable="false"]`,
    run: () => {},
}, { // send the message
    trigger: '.o_mail_send',
}, {
    trigger: '.o_widget_knowledge_chatter_panel .o-mail-Thread .o-mail-Message-body > p > a:nth-child(1).o_knowledge_behavior_type_article:contains("EditorCommandsArticle")',
    run: () => {},
}, {
    trigger: '.o_widget_knowledge_chatter_panel .o-mail-Thread .o-mail-Message-body > p > a:nth-child(2).o_knowledge_behavior_type_article:contains("LinkedArticle")',
    run: () => {},
}, { // close the chatter
    trigger: '.btn-chatter',
    run: 'click',
}];

// MISC: Article command usage

const articleCommandUsageSteps = [{ // wait for the block to appear in the editor
    trigger: '.o_knowledge_behavior_type_article:contains("LinkedArticle")',
    run: 'click',
}, { // check that the view switched to the corresponding article while keeping the breadcrumbs history
    trigger: '.o_knowledge_header:has(.o_breadcrumb_article_name_container:contains("LinkedArticle")):has(.breadcrumb-item > a:contains("EditorCommandsArticle"))'
}, { // Go back via the breadcrumb
    trigger: '.o_back_button'
}, { // Wait for the article to be properly loaded
    trigger: '.odoo-editor-editable:contains("EditorCommandsArticle Content")',
    run: () => {}
}];

/** MISC: Clipboard usage on a contact
 *
 * Has to stay last for 2 reasons:
 * - It's important to be executed in an article that has embed views inside it, to make sure that
 *   the breadcrumbs from embed views don't interfere with the macro system ;
 * - It actually leaves the main article, meaning any steps after this one would have to manually
 *   re-enter the article from the Knowledge app (could have side effects, see file introduction).
 */

const clipboardUsageSteps = [{ // open the chatter
    trigger: '.btn-chatter',
    run: 'click',
}, {
    trigger: '.o-mail-Thread',
    run: () => {},
}, { // open the follower list of the article
    trigger: '.o-mail-Followers-button',
    run: 'click',
}, { // open the contact record of the follower
    trigger: '.o-mail-Follower-details:contains(HelloWorldPartner)',
    run: 'click',
}, { // verify that the partner form view is fully loaded
    trigger: '.o_breadcrumb .o_last_breadcrumb_item.active:contains(HelloWorldPartner)',
    run: () => {},
}, { // return to the knowledge article by going back from the breadcrumbs
    trigger: '.o_breadcrumb a:contains(EditorCommandsArticle)',
    run: 'click',
}, {
    trigger: '.o_knowledge_behavior_type_template button:first:contains(Copy)',
    run: () => {},
}, { // open the chatter again
    trigger: '.btn-chatter',
    run: 'click',
}, {
    trigger: '.o-mail-Thread',
    run: () => {},
}, { // open the follower list of the article
    trigger: '.o-mail-Followers-button',
    run: 'click',
}, { // open the contact record of the follower
    trigger: '.o-mail-Follower-details:contains(HelloWorldPartner)',
    run: 'click',
}, { // verify that the partner form view is fully loaded
    trigger: '.o_breadcrumb .o_last_breadcrumb_item.active:contains(HelloWorldPartner)',
    run: () => {},
}, { // search an article to open it from the contact record
    trigger: 'button[title="Search Knowledge Articles"]',
    run: 'click',
}, { // open the article
    trigger: '.o_command_default:contains(EditorCommandsArticle)',
    run: 'click',
}, { // wait for article to be correctly loaded
    trigger: '.o_breadcrumb_article_name_container:contains("EditorCommandsArticle")',
    run: () => {},
}, { // use the template as description for the contact record
    trigger: '.o_knowledge_behavior_type_template button:contains(Use as)',
    run: 'click',
}, { // check that the content of the template was inserted as description
    trigger: '.o_form_sheet .o_field_html .odoo-editor-editable p:first-child:contains("Hello world")',
    run: () => {},
}];

registry.category("web_tour.tours").add('knowledge_article_commands_tour', {
    url: '/web',
    test: true,
    steps: () => [stepUtils.showAppsMenuItem(), {
    // open the Knowledge App
    trigger: '.o_app[data-menu-xmlid="knowledge.knowledge_menu_root"]',
},
    // Regular commands
    ...articleCommandSteps,
    ...fileCommandSteps,
    ...indexCommandSteps,
    ...tocCommandSteps,
    ...videoCommandSteps,
    ...clipboardCommandSteps,
    // Embed view commands
    ...listCommandSteps,
    ...embedKanbanSteps,
    ...embedKanbanActWindowSteps,
    ...embedCardsKanbanSteps,
    // Misc
    ...embedViewFiltersSteps,
    ...embedKanbanEditArticleSteps,
    ...articleCommandUsageSteps,
    ...articleCommandComposerSteps,
    ...clipboardUsageSteps,  // has to stay last, see steps docstring
    ...videoUnpatchSteps,
    ...endKnowledgeTour()
]});
