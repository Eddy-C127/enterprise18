# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import tagged
from odoo.addons.base.tests.common import HttpCaseWithUserDemo
from odoo.addons.knowledge.tests.test_knowledge_article_business import KnowledgeCommonBusinessCase


@tagged('post_install', '-at_install', 'knowledge', 'knowledge_tour', 'knowledge_comments')
class TestKnowledgeArticleTours(HttpCaseWithUserDemo):

    @classmethod
    def setUpClass(cls):
        """ The test article body contains custom selectors to ease the test steps as well as a
         pre-existing comment on the second paragraph. """

        super().setUpClass()

        cls.test_article = cls.env['knowledge.article'].create([{
            'name': 'Sepultura',
            'is_article_visible_by_everyone': True
        }])

        cls.test_article_thread = cls.env['knowledge.article.thread'].create({
            'article_id': cls.test_article.id,
            'article_anchor_text': """
                <span data-id="1"
                    class="knowledge-thread-comment knowledge-thread-highlighted-comment">
                    Lorem ipsum dolor
                </span>
            """,
        })
        cls.test_article_thread.message_post(
            body="Marc, can you check this?",
            message_type="comment"
        )

        cls.test_article.write({
            'body': f"""
                <p class="o_knowledge_tour_first_paragraph">
                    Lorem ipsum dolor sit amet,
                </p>
                <p>
                    <span data-id="{cls.test_article_thread.id}"
                        class="knowledge-thread-comment knowledge-thread-highlighted-comment">
                        Lorem ipsum dolor
                    </span>
                </p>
            """
        })

    def test_knowledge_article_comments(self):
        self.start_tour('/odoo', 'knowledge_article_comments', login='demo')

        # assert messages and resolved status
        self.assertTrue(self.test_article_thread.is_resolved)
        expected_messages = [
            "Marc, can you check this?",
            "Sure thing boss, all done!",
            "Oops forgot to mention, will be done in task-112233",
        ]

        for message, expected_message in zip(
            self.test_article_thread.message_ids
                .filtered(lambda message: message.message_type == 'comment')
                .sorted('create_date').mapped('body'),
            expected_messages
        ):
            self.assertIn(expected_message, message)

        new_thread = self.env['knowledge.article.thread'].search([
            ('article_id', '=', self.test_article.id),
            ('id', '!=', self.test_article_thread.id),
        ])
        self.assertEqual(len(new_thread), 1)
        self.assertEqual(len(new_thread.message_ids), 1)
        self.assertIn("My Knowledge Comment", new_thread.message_ids[0].body)


class TestKnowledgeArticleThreadCrud(KnowledgeCommonBusinessCase):

    def test_knowledge_article_thread_create_w_unsafe_anchors(self):
        new_thread = self.env['knowledge.article.thread'].create({
            'article_id': self.article_workspace.id,
            'article_anchor_text': """
                <span data-id="1"
                    class="knowledge-thread-comment knowledge-thread-highlighted-comment">
                    <iframe src="www.pwned.com">Anchor</iframe><script src="www.extrapwned.com"/>Text
                </span>
            """,
        })
        self.assertEqual("Anchor Text", new_thread.article_anchor_text)

        new_thread.write({
            'article_anchor_text': """
                <span data-id="3"
                    class="knowledge-thread-comment knowledge-thread-highlighted-comment">
                    <iframe src="javascript:alert(1)">Should be</iframe><script src="www.extrapwned.com"/>Purified
                </span>
            """
        })
        self.assertEqual("Should be Purified", new_thread.article_anchor_text)
