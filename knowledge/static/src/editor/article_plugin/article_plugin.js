import { Plugin } from "@html_editor/plugin";
import { MAIN_PLUGINS } from "@html_editor/plugin_sets";
import { rightPos } from "@html_editor/utils/position";
import { ArticleSelectionBehaviorDialog } from "@knowledge/components/behaviors/article_behavior_dialog/article_behavior_dialog";
import { encodeDataBehaviorProps } from "@knowledge/js/knowledge_utils";
import { _t } from "@web/core/l10n/translation";
import { renderToElement } from "@web/core/utils/render";

const ARTICLE_LINKS_SELECTOR = ".o_knowledge_behavior_type_article";
class KnowledgeArticlePlugin extends Plugin {
    static dependencies = ["dom", "selection"];
    static resources = (p) => ({
        powerboxItems: [
            {
                category: "navigation",
                name: _t("Article"),
                description: _t("Insert an Article shortcut"),
                fontawesome: "fa-file",
                action: () => {
                    p.addArticle();
                },
            },
        ],
    });

    handleCommand(command, payload) {
        switch (command) {
            case "CLEAN":
                this.clean(payload.root);
                break;
            case "NORMALIZE":
                this.normalize(payload.node);
                break;
        }
    }

    addArticle() {
        const selection = this.shared.getEditableSelection();
        let restoreSelection = () => {
            this.shared.setSelection(selection);
        };
        this.services.dialog.add(
            ArticleSelectionBehaviorDialog,
            {
                title: _t("Link an Article"),
                confirmLabel: _t("Insert Link"),
                articleSelected: (article) => {
                    const articleLinkBlock = renderToElement("knowledge.ArticleBehaviorBlueprint", {
                        href: "/knowledge/article/" + article.articleId,
                        data: encodeDataBehaviorProps({
                            article_id: article.articleId,
                            display_name: article.displayName,
                        }),
                    });

                    // TODO ABD: textNode and oeProtected management are there for legacy editor
                    // compatibility, can be refactored once legacy editor is removed.
                    const nameNode = this.document.createTextNode(article.displayName);
                    articleLinkBlock.appendChild(nameNode);
                    delete articleLinkBlock.dataset.oeProtected;

                    this.shared.domInsert(articleLinkBlock);
                    const [anchorNode, anchorOffset] = rightPos(articleLinkBlock);
                    this.dispatch("ADD_STEP");
                    this.shared.setSelection({ anchorNode, anchorOffset });

                    // TODO ABD: onClose is called after articleSelected in the dialog for the
                    // legacy editor, can be refactored once legacy editor is removed.
                    restoreSelection = () => {};
                },
            },
            {
                onClose: () => {
                    restoreSelection();
                },
            }
        );
    }

    scanForArticleLinks(element) {
        const articleLinks = [...element.querySelectorAll(ARTICLE_LINKS_SELECTOR)];
        if (element.matches(ARTICLE_LINKS_SELECTOR)) {
            articleLinks.unshift(element);
        }
        return articleLinks;
    }

    normalize(element) {
        const articleLinks = this.scanForArticleLinks(element);
        for (const articleLink of articleLinks) {
            articleLink.setAttribute("target", "_blank");
            articleLink.setAttribute("contenteditable", "false");
        }
    }

    clean(root) {
        const articleLinks = this.scanForArticleLinks(root);
        for (const articleLink of articleLinks) {
            articleLink.removeAttribute("contenteditable");
        }
    }
}

// add KnowledgeArticlePlugin for all standard use cases
MAIN_PLUGINS.push(KnowledgeArticlePlugin);
