/** @odoo-module **/

import { EmbeddedControllersPatch } from "@knowledge/views/embedded_controllers_patch";
import { KanbanController } from "@web/views/kanban/kanban_controller";
import { kanbanView } from "@web/views/kanban/kanban_view";
import { registry } from "@web/core/registry";

export class KnowledgeArticleItemsKanbanController extends EmbeddedControllersPatch(KanbanController) {
    /**
     * @override
     * Some actions require write access on the parent article. Disable those actions if the user
     * does not have it.
     * (note: since this piece of data is stored in the context, it will be lost on reload and the
     * actions will be enabled by default).
     */
    setup() {
        super.setup();
        if (!this.env.searchModel.context.knowledgeArticleUserCanWrite) {
            if (this.env.searchModel.context.knowledgeArticleUserCanWrite === false) {
                ["create", "createGroup", "deleteGroup", "editGroup"].forEach(
                    (action) => (this.props.archInfo.activeActions[action] = false),
                );
                this.props.archInfo.groupsDraggable = false;
            }
            // Quick creation is disabled if the knowledgeArticleUserCanWrite key is missing,
            // because in that case other keys needed for quick creation are missing too
            this.props.archInfo.activeActions.quickCreate = false;
        }
    }
}

registry.category("views").add('knowledge_article_view_kanban_embedded', {
    ...kanbanView,
    Controller: KnowledgeArticleItemsKanbanController
});
