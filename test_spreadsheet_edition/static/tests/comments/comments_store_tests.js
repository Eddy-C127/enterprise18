/** @odoo-module */

// Add a test here we can see the message of a currently hidden sheet (should unhide the sheet)
import { stores } from "@odoo/o-spreadsheet";

import { CommentsStore } from "@spreadsheet_edition/bundle/comments/comments_store";
import { setupWithThreads } from "../utils/helpers";

const { CellPopoverStore } = stores;

QUnit.module("Comments Thread Store", {}, () => {
    QUnit.test("Change thread visibility", async (assert) => {
        const { env } = await setupWithThreads();
        const commentsStore = env.getStore(CommentsStore);
        assert.ok(commentsStore.areCommentsActive);
        commentsStore.toggleComments();
        assert.notOk(commentsStore.areCommentsActive);
        commentsStore.toggleComments();
        assert.ok(commentsStore.areCommentsActive);
    });

    QUnit.test("Open a comment thread", async (assert) => {
        const { model, env } = await setupWithThreads();
        const commentsStore = env.getStore(CommentsStore);
        model.dispatch("RESIZE_SHEETVIEW", { width: 1000, height: 1000 }); // Require a viewport big enough to display the popover
        const threadId = 1;
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("ADD_COMMENT_THREAD", { sheetId, col: 0, row: 0, threadId });
        commentsStore.openCommentThread(threadId);
        const popoverStore = env.getStore(CellPopoverStore);
        assert.equal(popoverStore.persistentCellPopover.type, "OdooCellComment");
    });

    QUnit.test("Opening a thread makes the threads visible", async (assert) => {
        const { model, env } = await setupWithThreads();
        const commentsStore = env.getStore(CommentsStore);
        const popoverStore = env.getStore(CellPopoverStore);
        model.dispatch("RESIZE_SHEETVIEW", { width: 1000, height: 1000 }); // require a viewport to display the popover
        const threadId = 1;
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("ADD_COMMENT_THREAD", { sheetId, col: 0, row: 0, threadId });
        commentsStore.toggleComments();
        assert.equal(popoverStore.persistentCellPopover.type, undefined);
        commentsStore.openCommentThread(threadId);
        assert.equal(popoverStore.persistentCellPopover.type, "OdooCellComment");
    });

    QUnit.test("Scrolling the viewport should close the comments popover", async (assert) => {
        const { model, env } = await setupWithThreads();
        const commentsStore = env.getStore(CommentsStore);
        model.dispatch("RESIZE_SHEETVIEW", { width: 1000, height: 1000 }); // Require a viewport big enough to display the popover
        const threadId = 1;
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("ADD_COMMENT_THREAD", { sheetId, col: 0, row: 0, threadId });
        commentsStore.openCommentThread(threadId);
        const popoverStore = env.getStore(CellPopoverStore);
        assert.equal(popoverStore.persistentCellPopover.type, "OdooCellComment");
        model.dispatch("SET_VIEWPORT_OFFSET", { offsetX: 100, offsetY: 0 });
        assert.equal(popoverStore.persistentCellPopover.type, undefined);
    });

    QUnit.test("Selecting a resolved thread closes the popover", async (assert) => {
        const { model, env } = await setupWithThreads();
        const commentsStore = env.getStore(CommentsStore);
        const popoverStore = env.getStore(CellPopoverStore);
        model.dispatch("RESIZE_SHEETVIEW", { width: 1000, height: 1000 }); // Require a viewport big enough to display the popover
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("ADD_COMMENT_THREAD", { sheetId, col: 0, row: 0, threadId: 1 });
        model.dispatch("ADD_COMMENT_THREAD", { sheetId, col: 0, row: 1, threadId: 2 });
        model.dispatch("EDIT_COMMENT_THREAD", {
            sheetId,
            col: 0,
            row: 1,
            threadId: 2,
            isResolved: true,
        });
        commentsStore.openCommentThread(1);
        assert.equal(popoverStore.persistentCellPopover.type, "OdooCellComment");
        commentsStore.openCommentThread(2);
        assert.equal(popoverStore.persistentCellPopover.type, undefined);
    });
});
