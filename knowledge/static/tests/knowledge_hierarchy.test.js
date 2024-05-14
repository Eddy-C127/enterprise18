import KnowledgeHierarchy from "@knowledge/components/hierarchy/hierarchy";

import { registry } from "@web/core/registry";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";

import { after, before, expect, test } from "@odoo/hoot";
import { click, queryFirst } from "@odoo/hoot-dom";
import { animationFrame } from "@odoo/hoot-mock";
import {
    defineModels,
    fields,
    models,
    mountView,
    onRpc,
    patchWithCleanup,
} from "@web/../tests/web_test_helpers";

class Article extends models.Model {
    name = fields.Char();
    icon = fields.Char();
    display_name = fields.Char();
    parent_id = fields.Many2one({ relation: "article" });
    root_article_id = fields.Many2one({ relation: "article" });
    parent_path = fields.Char();
    is_locked = fields.Boolean();
    user_can_write = fields.Boolean();
    user_has_access = fields.Boolean();
    category = fields.Char();

    _records = [
        {
            id: 1,
            name: "Root Article",
            icon: "🙂",
            display_name: "🙂 Root Article",
            parent_id: false,
            root_article_id: 1,
            parent_path: "1/",
            is_locked: false,
            user_can_write: true,
            user_has_access: true,
            category: "workspace",
        },
        {
            id: 2,
            name: "Article 2",
            icon: "🙃",
            display_name: "🙃 Article 2",
            parent_id: 1,
            root_article_id: 1,
            parent_path: "1/2/",
            is_locked: false,
            user_can_write: true,
            user_has_access: true,
            category: "workspace",
        },
        {
            id: 3,
            name: "Article 3",
            icon: false,
            display_name: "Article 3",
            parent_id: 2,
            root_article_id: 1,
            parent_path: "1/2/3/",
            is_locked: false,
            user_can_write: true,
            user_has_access: true,
            category: "workspace",
        },
        {
            id: 4,
            name: "Article 4",
            icon: "😎",
            display_name: "😎 Article 4",
            parent_id: 3,
            root_article_id: 1,
            parent_path: "1/2/3/4/",
            is_locked: false,
            user_can_write: true,
            user_has_access: true,
            category: "workspace",
        },
        {
            id: 5,
            name: "Article 5",
            icon: false,
            display_name: "Article 5",
            parent_id: false,
            root_article_id: 5,
            parent_path: "5/",
            is_locked: false,
            user_can_write: true,
            user_has_access: true,
            category: "workspace",
        },
    ];

    static getArticleById(articleId) {
        return this._records.find((article) => article.id === articleId);
    }
}

defineModels([Article]);

onRpc("get_sidebar_articles", () => {
    return { articles: Article._records, favorite_ids: [] };
});

onRpc(
    "get_article_hierarchy",
    async function ({ args: [articleId], kwargs: { exclude_article_ids: excludeArticleIds } }) {
        // returns ancestors of the current article (without the ones given in excludeArticleIds)
        return Article._records
            .slice(0, Article._records.indexOf(Article.getArticleById(articleId)) - 1)
            .filter((article) => !excludeArticleIds.includes(article.id));
    },
);

let openArticle;

before(() => {
    // Patch the component to make it a widget so that it can be tested without the complete topbar
    patchWithCleanup(KnowledgeHierarchy.props, { ...standardWidgetProps });
    registry.category("view_widgets").add("knowledge_hierarchy", {
        component: KnowledgeHierarchy,
        fieldDependencies: Object.keys(Article._fields).map((fieldName) => {
            return { name: fieldName, type: Article._fields[fieldName]().type };
        }),
    });
    // Patch to allow loading an article easily
    patchWithCleanup(KnowledgeHierarchy.prototype, {
        setup() {
            super.setup();
            openArticle = (resId) => this.env.openArticle(resId);
        },
    });
});
after(() => registry.category("view_widgets").remove("knowledge_hierarchy"));

/**
 * Assert that the current article in the hierarchy is the given one
 * @param {number} articleId
 */
const assertCurrentArticle = (articleId) => {
    expect(`.o_article_active:contains(${Article.getArticleById(articleId).name})`).toHaveCount(1);
};

/**
 * Assert that the hierarchy shows the articles in the same order as in the given array.
 * @param {array} articleIds - array of article ids (or false for the dropdown toggle)
 */
const assertHierarchyArticles = async (articleIds) => {
    expect(".o_hierarchy_item").toHaveCount(articleIds.length);
    if (articleIds.length > 3) {
        // Open dropdown to check articles between root and parent
        await openHierarchyDropdown();
    }
    articleIds.forEach((articleId, idx) => {
        const article = Article.getArticleById(articleId);
        if (idx === articleIds.length - 1) {
            // current article
            expect(`.o_hierarchy_item:last-of-type:contains(${article.icon || "📄"})`).toHaveCount(
                1,
            );
            if (article.is_locked || !article.user_can_write) {
                expect(`.o_hierarchy_item:last-of-type:contains(${article.name})`).toHaveCount(1);
            } else {
                expect(`.o_hierarchy_item:last-of-type input:value(${article.name})`).toHaveCount(
                    1,
                );
            }
        } else if (idx < articleIds.length - 2 && idx > 0) {
            // article in dropdown
            expect(
                `.o-dropdown-item:nth-of-type(${idx}):contains(${article.display_name})`,
            ).toHaveCount(1);
        } else {
            // root or parent article
            expect(
                `.o_hierarchy_item:nth-of-type(${idx + 1}) a:contains(${article.display_name})`,
            ).toHaveCount(1);
        }
    });
};

/**
 * Click on the given article in the hierarchy
 * @param {number} id of the article to open
 */
const clickHierarchyArticle = async (articleId) => {
    const articleName = Article.getArticleById(articleId).name;
    const articleElement = queryFirst(`.o_hierarchy_item:contains(${articleName})`);
    if (articleElement) {
        click(articleElement.querySelector("a"));
    } else {
        await openHierarchyDropdown();
        click(`.o-dropdown-item:contains(${articleName})`);
    }
    return await animationFrame();
};

/**
 * open the dropdown in the hierarchy
 */
const openHierarchyDropdown = async () => {
    if (queryFirst(".o_hierarchy_item a:contains('...').show")) {
        // dropdown already opened
        return;
    }
    click(".o_hierarchy_item a:contains('...')");
    return await animationFrame();
};

const viewParams = {
    arch: /* xml */ `
        <form js_class="knowledge_article_view_form">
            <widget name="knowledge_hierarchy" class="d-flex"/>
        </form>
    `,
    resModel: "article",
    type: "form",
};

test("Hierarchy - Open articles in hierarchy", async function () {
    await mountView({ ...viewParams, resId: 4 });
    // Check that root, ellipsis, parent and current article are shown
    await assertHierarchyArticles([1, 2, 3, 4]);
    // Open article 3
    await clickHierarchyArticle(3);
    // Check that root, parent and current article are shown
    await assertHierarchyArticles([1, 2, 3]);
    // Open Article 2
    await clickHierarchyArticle(2);
    // Check that root and current article are shown
    await assertHierarchyArticles([1, 2]);
    // Open Root Article
    await clickHierarchyArticle(1);
    // Check that root is shown
    await assertHierarchyArticles([1]);
    openArticle(4);
    await animationFrame();
    await assertHierarchyArticles([1, 2, 3, 4]);
    // Open Article 2 in the dropdown
    await clickHierarchyArticle(2);
    // Check that article 2 is opened
    assertCurrentArticle(2);
});

test("Hierarchy - Inaccessible articles", async function (assert) {
    Article.getArticleById(2).user_has_access = false;
    Article.getArticleById(4).user_can_write = false;
    await mountView({ ...viewParams, resId: 4 });
    // Check that the hierarchy is correct and that current article's icon and name are readonly
    await assertHierarchyArticles([1, 2, 3, 4]);
    expect(".o_hierarchy_item a.o_article_emoji").toHaveCount(0);
    expect(".o_hierarchy_item input").toHaveCount(0);
    // Check that the link to the article in the dropdown is disabled
    expect(`.o-dropdown-item.disabled:contains(${Article.getArticleById(2).display_name})`).toHaveCount(
        1,
    );
});

test("Hierarchy - Use breadcrumbs", async function (assert) {
    /**
     * Assert that the breadcrumbs buttons are enabled/disabled
     * @param {boolean} isPrevEnabled
     * @param {boolean} isNextEnabled
     */
    const assertBreadcrumbsButtons = (isPrevEnabled, isNextEnabled) => {
        expect(
            `.o_widget_knowledge_hierarchy .btn${isPrevEnabled ? ":not(.disabled)" : ".disabled"} .oi-chevron-left`,
        ).toHaveCount(1);
        expect(
            `.o_widget_knowledge_hierarchy .btn${isNextEnabled ? ":not(.disabled)" : ".disabled"} .oi-chevron-right`,
        ).toHaveCount(1);
    };
    const clickBack = async () => {
        click(".o_widget_knowledge_hierarchy .oi-chevron-left");
        return await animationFrame();
    };
    const clickNext = async () => {
        click(".o_widget_knowledge_hierarchy .oi-chevron-right");
        return await animationFrame();
    };
    await mountView({ ...viewParams, resId: 2 });
    assertCurrentArticle(2);
    // Back and Next should be disabled
    assertBreadcrumbsButtons(false, false);
    // Open an article
    openArticle(1);
    await animationFrame();
    // Make sure current article changed
    assertCurrentArticle(1);
    // Back should be enabled, next should still be disabled
    assertBreadcrumbsButtons(true, false);
    // Use go back button, back should then be disabled and next should be enabled
    await clickBack();
    assertCurrentArticle(2);
    assertBreadcrumbsButtons(false, true);
    // Use go next button, back should then be enabled and next should be disabled
    await clickNext();
    assertCurrentArticle(1);
    assertBreadcrumbsButtons(true, false);
    // Open another article, back should then be enabled and next should be disabled
    openArticle(5);
    await animationFrame();
    assertCurrentArticle(5);
    assertBreadcrumbsButtons(true, false);
    // Use go back button twice, back should then be disabled and next should be enabled
    await clickBack();
    await clickBack();
    assertCurrentArticle(2);
    assertBreadcrumbsButtons(false, true);
    // Use go next button, back and next should then be enabled
    await clickNext();
    assertCurrentArticle(1);
    assertBreadcrumbsButtons(true, true);
    // Open another article, back should then be enabled and next should be disabled
    openArticle(5);
    await animationFrame();
    assertCurrentArticle(5);
    assertBreadcrumbsButtons(true, false);
});
