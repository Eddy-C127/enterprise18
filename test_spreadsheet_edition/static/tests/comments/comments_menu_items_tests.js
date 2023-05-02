import { registries, helpers } from "@odoo/o-spreadsheet";
import { getActionMenu } from "@spreadsheet/../tests/utils/ui";
import { getFixture, nextTick } from "@web/../tests/helpers/utils";
import { CommentsStore } from "@spreadsheet_edition/bundle/comments/comments_store";
import { createThread, setupWithThreads } from "../utils/helpers";

const { cellMenuRegistry, topbarMenuRegistry } = registries;
const { toCartesian } = helpers;

let fixture;

QUnit.module(
    "Comments Threads Menu Items",
    {
        beforeEach: function () {
            fixture = getFixture();
        },
    },
    () => {
        QUnit.test("visibility menu", async (assert) => {
            const { model, env } = await setupWithThreads();
            const action = await getActionMenu(
                topbarMenuRegistry,
                ["view", "show", "show_comments"],
                env
            );
            assert.strictEqual(action.isActive(env), true);
            const commentsStore = env.getStore(CommentsStore);
            commentsStore.toggleComments();
            model.dispatch("TOGGLE_COMMENTS");
            assert.strictEqual(action.isActive(env), false);
        });

        QUnit.test("Insert thread topbar menu", async (assert) => {
            const { env } = await setupWithThreads();
            const action = await getActionMenu(
                topbarMenuRegistry,
                ["insert", "insert_comment"],
                env
            );
            assert.strictEqual(action.isVisible(env), true);
            await action.execute(env);
            await nextTick();
            assert.containsOnce(fixture, ".o-thread-popover");
            assert.containsNone(fixture, ".o-mail-Thread");
            assert.containsOnce(fixture, ".o-mail-Composer");
            const mailComposerInput = fixture.querySelector(".o-mail-Composer textarea");
            assert.strictEqual(document.activeElement, mailComposerInput);
        });

        QUnit.test("Open sidepanel from topbar menu", async (assert) => {
            const { model, pyEnv, env } = await setupWithThreads();
            const action = await getActionMenu(topbarMenuRegistry, ["view", "view_comments"], env);
            const sheetId = model.getters.getActiveSheetId();
            await createThread(model, pyEnv, { sheetId, ...toCartesian("A2") }, ["wave"]);
            await action.execute(env);
            await nextTick();
            assert.containsOnce(fixture, ".o-threads-side-panel");
            assert.containsN(fixture, ".o-threads-side-panel .o-thread-item", 1);
        });

        QUnit.test("Start a thread from cell menu", async (assert) => {
            const { env } = await setupWithThreads();
            const action = await getActionMenu(cellMenuRegistry, ["insert_comment"], env);
            assert.strictEqual(action.isVisible(env), true);
            await action.execute(env);
            await nextTick();
            assert.containsOnce(fixture, ".o-thread-popover");
            assert.containsNone(fixture, ".o-mail-Thread");
            assert.containsOnce(fixture, ".o-mail-Composer");
            const composerInput = fixture.querySelector(
                ".o-thread-popover .o-mail-Composer textarea"
            );
            assert.strictEqual(document.activeElement, composerInput);
        });

        QUnit.test("Jump to an existing thread from the cell menu", async (assert) => {
            const { model, env, pyEnv } = await setupWithThreads();
            const sheetId = model.getters.getActiveSheetId();
            await createThread(model, pyEnv, { sheetId, ...toCartesian("B2") }, ["wave"]);
            const action = await getActionMenu(cellMenuRegistry, ["insert_comment"], env);
            // invisible on cell with a thread
            model.selection.selectCell(1, 1);
            assert.strictEqual(action.isVisible(env), true);
        });
    }
);
