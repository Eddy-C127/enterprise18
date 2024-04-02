# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import tagged
from odoo.addons.base.tests.common import HttpCaseWithUserDemo


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
        self.start_tour('/web', 'knowledge_article_comments', login='demo')

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
