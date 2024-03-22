/** @odoo-module */

import { EmbeddedControllersPatch } from "@knowledge/views/embedded_controllers_patch";
import { ListController } from '@web/views/list/list_controller';
import { listView } from '@web/views/list/list_view';
import { registry } from "@web/core/registry";

export class KnowledgeArticleItemsListController extends EmbeddedControllersPatch(ListController) {
    /**
     * @override
     * Item creation is not allowed if the user can not edit the parent article.
     * (note: since this piece of data is stored in the context, it will be lost on reload and item
     * creation will be enabled by default).
     */
    setup() {
        super.setup();
        if (this.env.searchModel.context.knowledgeArticleUserCanWrite === false) {
            this.activeActions.create = false;
        }
    }
}

registry.category("views").add('knowledge_article_view_tree_embedded', {
    ...listView,
    Controller: KnowledgeArticleItemsListController
});
