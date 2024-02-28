/** @odoo-module */

import { registry } from "@web/core/registry";
import { insertText } from "@web/../tests/utils";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

import { makeVisible, endKnowledgeTour } from './knowledge_tour_utils.js';
import { setSelection, boundariesIn } from "@web_editor/js/editor/odoo-editor/src/utils/utils";

const addAnswerComment = (commentText) => [{
    trigger: '.o-mail-Composer-input',
    run: async () => {
        await insertText('.o-mail-Composer-input', commentText);
    }
}, {
    // Send comment
    trigger: '.o-mail-Composer-send:not([disabled=""])'
}, {
    trigger: `.o-mail-Thread :contains(${commentText})`,
    run: () => {}
}];

registry.category('web_tour.tours').add('knowledge_article_comments', {
    test: true,
    url: '/web',
    steps: () => [
        stepUtils.showAppsMenuItem(), { // Open Knowledge App
            trigger: '.o_app[data-menu-xmlid="knowledge.knowledge_menu_root"]',
        }, {
            trigger: 'section[data-section="workspace"] .o_article .o_article_name:contains("Sepultura")'
        }, {
            trigger: '.o_knowledge_comment_box[data-id] .o_knowledge_comment_small_ui img',
        }, {
            trigger: '.o-mail-Thread :contains("Marc, can you check this?")',
            run: () => {}
        },
        ...addAnswerComment("Sure thing boss, all done!"),
        {
            trigger: '.o-mail-Message-actions',
            run: () => {
                makeVisible('.o-mail-Message-actions');
            }
        }, { // Resolve Thread
            trigger: 'button[name="closeThread"]'
        }, { // Wait for the composer to be fully closed
            trigger: 'body:not(:has(".o-mail-Thread"))',
            run: () => {}
        }, { // Select some text in the first paragraph
            trigger: '.note-editable p.o_knowledge_tour_first_paragraph',
            run: function () {
                setSelection(...boundariesIn(this.anchor));
            }
        }, { // Trigger comment creation with the editor toolbar
            trigger: '.oe-toolbar div[id="comment-line"]',
        }, {
            trigger: '.o_knowledge_comments_popover .o-mail-Composer-input',
            run: async () => {
                await insertText('.o-mail-Composer-input', 'My Knowledge Comment');
            }
        }, { // Send comment
            trigger: '.o_knowledge_comments_popover .o-mail-Composer-send:not([disabled=""])'
        }, { // Wait for the composer to be fully closed
            trigger: 'body:not(:has(".o-mail-Thread"))',
            run: () => {}
        }, {
            trigger: '.o_knowledge_comment_box[data-id] .o_knowledge_comment_small_ui img',
            run: () => {}
        }, { // Open the comments panel
            trigger: '.btn-comments'
        }, { // Panel loads un-resolved messages
            trigger: '.o-mail-Thread :contains("My Knowledge Comment")',
            run: () => {}
        }, { // Switch to "resolved" mode
            trigger: '.o_knowledge_comments_panel select',
            run: 'text resolved'
        }, { // Panel loads resolved messages
            trigger: '.o-mail-Thread :contains("Sure thing boss, all done!")',
            run: () => {}
        }, { // Open the comment to enable replies
            trigger: '.o_knowledge_comment_box'
        },
        // Add an extra reply to the resolved comment
        ...addAnswerComment("Oops forgot to mention, will be done in task-112233"),
        ...endKnowledgeTour()
    ]
});
