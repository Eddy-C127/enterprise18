import { Model, helpers } from "@odoo/o-spreadsheet";
import { getBasicServerData } from "@spreadsheet/../tests/utils/data";
import { setupCollaborativeEnv } from "@spreadsheet_edition/../tests/utils/collaborative_helpers";
import { undo, redo, addColumns, deleteColumns } from "@spreadsheet/../tests/utils/commands";

const { toCartesian, toZone } = helpers;

QUnit.module("Comments Thread Plugin", {}, () => {
    QUnit.test("Simple thread creation", (assert) => {
        const model = new Model({ sheets: [{ id: "sh1" }] });
        const threadId = 1;
        const cellPosition = { sheetId: "sh1", ...toCartesian("A1") };

        model.dispatch("ADD_COMMENT_THREAD", { ...cellPosition, threadId });
        assert.deepEqual(model.getters.getThreadInfo(threadId), {
            ...cellPosition,
            threadId,
            isResolved: false,
        });
        const threadIds = model.getters.getCellThreads(cellPosition);
        assert.deepEqual(threadIds, [{ threadId, isResolved: false }]);

        undo(model);
        assert.deepEqual(model.getters.getThreadInfo(threadId), undefined);
        assert.strictEqual(model.getters.getCellThreads(cellPosition), undefined);

        redo(model);
        assert.deepEqual(model.getters.getThreadInfo(threadId), {
            ...cellPosition,
            threadId,
            isResolved: false,
        });
        assert.deepEqual(model.getters.getCellThreads(cellPosition), [
            { threadId, isResolved: false },
        ]);
    });

    QUnit.test("Multiple threads on the same cell", (assert) => {
        const model = new Model({ sheets: [{ id: "sh1" }] });
        const cellPosition = { sheetId: "sh1", ...toCartesian("A1") };

        model.dispatch("ADD_COMMENT_THREAD", { ...cellPosition, threadId: 1 });
        model.dispatch("ADD_COMMENT_THREAD", { ...cellPosition, threadId: 2 });
        const threadIds = model.getters.getCellThreads(cellPosition);
        assert.deepEqual(threadIds, [
            { threadId: 1, isResolved: false },
            { threadId: 2, isResolved: false },
        ]);
        undo(model);
        assert.deepEqual(model.getters.getCellThreads(cellPosition), [
            { threadId: 1, isResolved: false },
        ]);
        undo(model);
        assert.strictEqual(model.getters.getCellThreads(cellPosition), undefined);
        redo(model);
        assert.deepEqual(model.getters.getCellThreads(cellPosition), [
            { threadId: 1, isResolved: false },
        ]);
        redo(model);
        assert.deepEqual(model.getters.getCellThreads(cellPosition), [
            { threadId: 1, isResolved: false },
            { threadId: 2, isResolved: false },
        ]);
    });

    QUnit.test("Thread on merged cell", (assert) => {
        const model = new Model();
        const threadId = 1;
        const sheetId = model.getters.getActiveSheetId();
        const cellPosition = { sheetId, ...toCartesian("A1") };
        model.dispatch("ADD_MERGE", {
            sheetId,
            target: [toZone("A1:B2")],
            force: true,
        });
        model.dispatch("ADD_COMMENT_THREAD", { ...cellPosition, threadId });
        assert.deepEqual(model.getters.getThreadInfo(threadId), {
            ...cellPosition,
            threadId,
            isResolved: false,
        });
    });

    QUnit.test("Thread removed on sheet deletion", (assert) => {
        const model = new Model();
        model.dispatch("CREATE_SHEET", { sheetId: "sh2" });
        model.dispatch("ADD_COMMENT_THREAD", { sheetId: "sh2", col: 1, row: 1, threadId: 1 });
        assert.deepEqual(model.getters.getSpreadsheetThreads(["sh2"]), [
            { sheetId: "sh2", col: 1, row: 1, threadId: 1, isResolved: false },
        ]);
        model.dispatch("DELETE_SHEET", { sheetId: "sh2" });
        assert.deepEqual(model.getters.getSpreadsheetThreads(["sh2"]), []);
    });

    QUnit.test("Thread moved on sheet structure change", (assert) => {
        const model = new Model();
        const threadId = 1;
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("ADD_COMMENT_THREAD", { sheetId, ...toCartesian("B2"), threadId: 1 });
        assert.deepEqual(model.getters.getThreadInfo(threadId), {
            sheetId,
            ...toCartesian("B2"),
            threadId,
            isResolved: false,
        });
        addColumns(model, "before", "B", 1);
        assert.deepEqual(model.getters.getThreadInfo(threadId), {
            sheetId,
            ...toCartesian("C2"),
            threadId,
            isResolved: false,
        });
        deleteColumns(model, ["C"]);
        assert.deepEqual(model.getters.getThreadInfo(threadId), undefined);
    });

    QUnit.test("Can cut/paste a thread", (assert) => {
        const model = new Model();
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("ADD_COMMENT_THREAD", {
            sheetId,
            ...toCartesian("B2"),
            threadId: 1,
        });
        model.selection.selectCell(1, 1);
        model.dispatch("CUT");
        model.dispatch("PASTE", { target: [toZone("C2")] });
        assert.deepEqual(model.getters.getThreadInfo(1), {
            sheetId,
            ...toCartesian("C2"),
            threadId: 1,
            isResolved: false,
        });
    });

    QUnit.test("Threads are not affected by copy/paste", (assert) => {
        const model = new Model();
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("ADD_COMMENT_THREAD", {
            sheetId,
            ...toCartesian("B2"),
            threadId: 1,
        });
        model.selection.selectCell(1, 1);
        model.dispatch("COPY");
        model.dispatch("PASTE", { target: [toZone("C2")] });
        assert.deepEqual(model.getters.getThreadInfo(1), {
            sheetId,
            ...toCartesian("B2"),
            threadId: 1,
            isResolved: false,
        });
    });

    QUnit.test("Threads are not affected by paste from clipboard os", (assert) => {
        const model = new Model();
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("ADD_COMMENT_THREAD", {
            sheetId,
            ...toCartesian("B2"),
            threadId: 1,
        });
        model.selection.selectCell(1, 1);
        model.dispatch("PASTE_FROM_OS_CLIPBOARD", {
            target: [toZone("C2")],
            text: "coucou",
            pasteOption: {},
        });
        model.dispatch("PASTE", { target: [toZone("C2")] });
        assert.deepEqual(model.getters.getThreadInfo(1), {
            sheetId,
            ...toCartesian("B2"),
            threadId: 1,
            isResolved: false,
        });
    });

    QUnit.test("Resolve/re-open a thread", (assert) => {
        const model = new Model();
        const threadId = 1;
        const sheetId = model.getters.getActiveSheetId();
        const createPayload = { sheetId, ...toCartesian("B2"), threadId };
        const resolvedThread = { ...createPayload, isResolved: true };
        const openThread = { ...createPayload, isResolved: false };
        model.dispatch("ADD_COMMENT_THREAD", createPayload);
        model.dispatch("EDIT_COMMENT_THREAD", resolvedThread);
        assert.deepEqual(model.getters.getThreadInfo(1), resolvedThread);
        undo(model);
        assert.deepEqual(model.getters.getThreadInfo(1), openThread);
        redo(model);
        assert.deepEqual(model.getters.getThreadInfo(1), resolvedThread);
    });

    QUnit.test("Threads are imported/exported", (assert) => {
        const model = new Model();
        const threadId = 1;
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("ADD_COMMENT_THREAD", { sheetId, ...toCartesian("B2"), threadId });

        const newModel = new Model(model.exportData());
        assert.deepEqual(newModel.getters.getSpreadsheetThreads([sheetId]), [
            { sheetId, ...toCartesian("B2"), threadId, isResolved: false },
        ]);
    });

    QUnit.test("collaborative: Insert comment on sheet structure change", async (assert) => {
        const env = await setupCollaborativeEnv(getBasicServerData());
        const { alice, bob, charlie, network } = env;
        const sheetId = alice.getters.getActiveSheetId();

        await network.concurrent(() => {
            addColumns(alice, "before", "B", 1);
            bob.dispatch("ADD_COMMENT_THREAD", { sheetId, col: 4, row: 4, threadId: 1 });
        });

        assert.spreadsheetIsSynchronized(
            [alice, bob, charlie],
            (user) => user.getters.getSpreadsheetThreads([sheetId]),
            [{ sheetId, col: 5, row: 4, threadId: 1, isResolved: false }]
        );
    });

    QUnit.test("collaborative: Parallel insertion of comments", async (assert) => {
        const env = await setupCollaborativeEnv(getBasicServerData());
        const { alice, bob, charlie, network } = env;
        const sheetId = alice.getters.getActiveSheetId();

        await network.concurrent(() => {
            alice.dispatch("ADD_COMMENT_THREAD", { sheetId, col: 1, row: 1, threadId: 2 });
            bob.dispatch("ADD_COMMENT_THREAD", { sheetId, col: 4, row: 4, threadId: 1 });
        });

        assert.spreadsheetIsSynchronized(
            [alice, bob, charlie],
            (user) => user.getters.getSpreadsheetThreads([sheetId]),
            [
                { sheetId, col: 1, row: 1, threadId: 2, isResolved: false },
                { sheetId, col: 4, row: 4, threadId: 1, isResolved: false },
            ]
        );
        undo(alice);
        assert.spreadsheetIsSynchronized(
            [alice, bob, charlie],
            (user) => user.getters.getSpreadsheetThreads([sheetId]),
            [{ sheetId, col: 4, row: 4, threadId: 1, isResolved: false }]
        );
    });
});
