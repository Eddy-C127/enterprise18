import { helpers, stores } from "@odoo/o-spreadsheet";
import { click, getFixture, nextTick, editSelect } from "@web/../tests/helpers/utils";
import { CommentsStore } from "@spreadsheet_edition/bundle/comments/comments_store";
import { createThread, setupWithThreads } from "../utils/helpers";

const { CellPopoverStore } = stores;

const { toCartesian, toZone } = helpers;

let fixture;

QUnit.module(
    "Comments Threads Sidepanel",
    {
        beforeEach: function () {
            fixture = getFixture();
        },
    },
    () => {
        QUnit.test("Selected thread is highlighted in the side panel", async (assert) => {
            const { model, env, pyEnv } = await setupWithThreads();
            const sheetId = model.getters.getActiveSheetId();
            await createThread(model, pyEnv, { sheetId, ...toCartesian("A2") }, ["wave"]);
            await createThread(model, pyEnv, { sheetId, ...toCartesian("A3") }, ["wave"]);

            env.openSidePanel("Comments");
            await nextTick();

            assert.containsOnce(fixture, ".o-threads-side-panel");
            assert.containsN(fixture, ".o-threads-side-panel .o-thread-item", 2);
        });

        QUnit.test("Side panel filter 'active sheet'/'all sheets'", async (assert) => {
            const { model, env, pyEnv } = await setupWithThreads();
            const sheetId = model.getters.getActiveSheetId();
            const sheetId2 = "sh2";
            model.dispatch("CREATE_SHEET", { sheetId: sheetId2, position: 1 });
            await createThread(model, pyEnv, { sheetId, ...toCartesian("A2") }, ["wave"]);
            await createThread(model, pyEnv, { sheetId, ...toCartesian("A3") }, ["wave"]);
            await createThread(model, pyEnv, { sheetId: sheetId2, ...toCartesian("A3") }, ["wave"]);

            env.openSidePanel("Comments");
            await nextTick();
            assert.containsN(fixture, ".o-threads-side-panel .o-thread-item", 3);
            await editSelect(fixture, ".o-threads-side-panel select", "activeSheet");
            assert.containsN(fixture, ".o-threads-side-panel .o-thread-item", 2);
            model.dispatch("ACTIVATE_SHEET", { sheetIdTo: sheetId2, sheetIdFrom: sheetId });
            await nextTick();
            assert.containsOnce(fixture, ".o-threads-side-panel .o-thread-item");
        });

        QUnit.test("click on a thread in the side panel selects it in the grid", async (assert) => {
            const { model, env, pyEnv } = await setupWithThreads();
            const sheetId = model.getters.getActiveSheetId();
            await createThread(model, pyEnv, { sheetId, ...toCartesian("A2") }, ["wave"]);
            env.openSidePanel("Comments");
            await nextTick();
            assert.deepEqual(model.getters.getSelectedZone(), toZone("A1"));
            await click(fixture.querySelector(".o-threads-side-panel .o-thread-item"));
            assert.deepEqual(model.getters.getSelectedZone(), toZone("A2"));
        });

        QUnit.test("click on a thread in the side panel makes threads visible", async (assert) => {
            const { model, env, pyEnv } = await setupWithThreads();
            const sheetId = model.getters.getActiveSheetId();
            await createThread(model, pyEnv, { sheetId, ...toCartesian("A2") }, ["wave"]);
            const commentsStore = env.getStore(CommentsStore);
            env.openSidePanel("Comments");
            await nextTick();
            assert.equal(commentsStore.areCommentsActive, true);
            commentsStore.toggleComments();
            assert.equal(commentsStore.areCommentsActive, false);
            await click(fixture.querySelector(".o-threads-side-panel .o-thread-item"));
            assert.equal(commentsStore.areCommentsActive, true);
        });

        QUnit.test("Side panel does not close if visibility is off", async (assert) => {
            const { model, env, pyEnv } = await setupWithThreads();
            const commentsStore = env.getStore(CommentsStore);
            const sheetId = model.getters.getActiveSheetId();
            await createThread(model, pyEnv, { sheetId, ...toCartesian("A2") }, ["wave"]);
            env.openSidePanel("Comments");
            await nextTick();
            assert.containsOnce(fixture, ".o-threads-side-panel");
            commentsStore.toggleComments();
            await nextTick();
            assert.containsOnce(fixture, ".o-threads-side-panel");
        });

        QUnit.test("Resolve/Re-open thread from the side panel", async (assert) => {
            const { model, env, pyEnv } = await setupWithThreads();
            const popoverStore = env.getStore(CellPopoverStore);
            const sheetId = model.getters.getActiveSheetId();
            const cellPosition = { sheetId, ...toCartesian("A2") };
            await createThread(model, pyEnv, cellPosition, ["wave"]);
            env.openSidePanel("Comments");
            await nextTick();
            const thread = fixture.querySelector(".o-sidePanel .o-thread-item");
            await click(thread, null);
            assert.deepEqual(popoverStore.persistentCellPopover, {
                isOpen: true,
                col: 0,
                row: 1,
                sheetId: "Sheet1",
                type: "OdooCellComment",
            });
            await click(thread, "span.thread-menu");
            let menuItems = fixture.querySelectorAll(".o-menu .o-menu-item");
            await click(menuItems[0], null);
            let threadIds = model.getters.getCellThreads(cellPosition);
            assert.deepEqual(threadIds, [{ threadId: 1, isResolved: true }]);
            assert.containsOnce(fixture, ".o-sidePanel .o-thread-item span.resolved");
            assert.deepEqual(popoverStore.persistentCellPopover, { isOpen: false });

            await click(thread, "span.thread-menu");
            menuItems = fixture.querySelectorAll(".o-menu .o-menu-item");
            await click(menuItems[0], null);
            threadIds = model.getters.getCellThreads(cellPosition);
            assert.deepEqual(threadIds, [{ threadId: 1, isResolved: false }]);
            assert.containsNone(fixture, ".o-sidePanel .o-thread-item span.resolved");
            assert.deepEqual(popoverStore.persistentCellPopover, {
                isOpen: true,
                col: 0,
                row: 1,
                sheetId: "Sheet1",
                type: "OdooCellComment",
            });
        });
    }
);
