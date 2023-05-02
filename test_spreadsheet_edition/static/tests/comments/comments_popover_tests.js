import { helpers, stores, registries } from "@odoo/o-spreadsheet";
import { click, getFixture, nextTick } from "@web/../tests/helpers/utils";
import { contains } from "@web/../tests/utils";
import { getActionMenu } from "@spreadsheet/../tests/utils/ui";
import { selectCell } from "@spreadsheet/../tests/utils/commands";
import { createThread, setupWithThreads } from "../utils/helpers";
import { editInput, triggerEvent, triggerEvents } from "@web/../tests/legacy/helpers/utils";

const { topbarMenuRegistry } = registries;
const { HoveredCellStore } = stores;

const { toCartesian } = helpers;

let fixture;

QUnit.module(
    "Comments Threads Popover",
    {
        beforeEach: () => {
            fixture = getFixture();
        },
    },
    () => {
        QUnit.test("Hover cell only shows messages, Composer appears on click", async (assert) => {
            const { model, pyEnv, env } = await setupWithThreads();
            const sheetId = model.getters.getActiveSheetId();
            await createThread(model, pyEnv, { sheetId, ...toCartesian("A1") }, ["wave"]);

            env.getStore(HoveredCellStore).hover(0, 0);
            await contains(".o-thread-popover");

            assert.containsOnce(fixture, ".o-thread-popover .o-mail-Thread");
            assert.containsNone(fixture, ".o-thread-popover .o-mail-Composer");

            const popover = fixture.querySelector("div.o-thread-popover");
            await click(popover, null, { skipVisibilityCheck: true }); // div is empty until the messagesload but we don't need them
            assert.containsOnce(popover, ".o-mail-Thread");
            assert.containsOnce(popover, ".o-mail-Composer");
            const mailComposerInput = fixture.querySelector(".o-mail-Composer textarea");
            assert.strictEqual(document.activeElement, mailComposerInput);
        });

        QUnit.test(
            "Selecting the cell with an unsolved thread opens the thread in edit mode",
            async (assert) => {
                const { model, pyEnv } = await setupWithThreads();
                const sheetId = model.getters.getActiveSheetId();
                await createThread(model, pyEnv, { sheetId, ...toCartesian("A2") }, ["wave"]);
                selectCell(model, "A2");
                await nextTick();
                assert.containsOnce(fixture, ".o-thread-popover");
                assert.containsOnce(fixture, ".o-mail-Thread");
                assert.containsOnce(fixture, ".o-mail-Composer");
                const mailComposerInput = fixture.querySelector(".o-mail-Composer textarea");
                assert.strictEqual(document.activeElement, mailComposerInput);
            }
        );
        QUnit.test(
            "Selecting the cell with an unsolved thread does not open the thread popover",
            async (assert) => {
                const { model, pyEnv } = await setupWithThreads();
                const sheetId = model.getters.getActiveSheetId();
                await createThread(model, pyEnv, { sheetId, col: 0, row: 0 }, ["wave"]);
                const threadId = model.getters.getSpreadsheetThreads([sheetId])[0].threadId;
                model.dispatch("EDIT_COMMENT_THREAD", { threadId, sheetId, col: 0, row: 0 });
                selectCell(model, "A2");
                await nextTick();
                assert.containsNone(fixture, ".o-thread-popover");
                assert.containsNone(fixture, ".o-mail-Thread");
            }
        );

        QUnit.test("Send messages from the popover", async (assert) => {
            const { model, env } = await setupWithThreads();
            selectCell(model, "A2");
            const action = await getActionMenu(
                topbarMenuRegistry,
                ["insert", "insert_comment"],
                env
            );
            assert.strictEqual(action.isVisible(env), true);
            await action.execute(env);
            await nextTick();

            let mailComposerInput = fixture.querySelector(".o-mail-Composer textarea");
            assert.strictEqual(document.activeElement, mailComposerInput);

            await editInput(mailComposerInput, null, "msg1");
            await triggerEvent(mailComposerInput, null, "keydown", {
                key: "Enter",
                ctrlKey: true,
            });
            await contains(".o-mail-Message");
            let threadIds = model.getters.getCellThreads(model.getters.getActivePosition());
            assert.deepEqual(threadIds, [{ threadId: 1, isResolved: false }]);
            assert.strictEqual(fixture.querySelectorAll(".o-mail-Message").length, 1);

            assert.strictEqual(
                document.activeElement,
                fixture.querySelector(".o-mail-Composer textarea")
            );
            mailComposerInput = fixture.querySelector(".o-mail-Composer textarea");
            mailComposerInput.value = "msg2";
            await triggerEvents(mailComposerInput, null, ["input", "change"], {
                skipVisibilityCheck: true,
            });
            await nextTick();
            await click(fixture.querySelector(".o-mail-Composer-send"), null, {
                skipVisibilityCheck: true,
            });
            await contains(".o-mail-Message", { count: 2 });

            threadIds = model.getters.getCellThreads(model.getters.getActivePosition());
            assert.deepEqual(threadIds, [{ threadId: 1, isResolved: false }]);
            assert.strictEqual(fixture.querySelectorAll(".o-mail-Message").length, 2);
        });

        QUnit.test("Open side panel from thread popover", async (assert) => {
            const { model, pyEnv } = await setupWithThreads();
            const sheetId = model.getters.getActiveSheetId();
            await createThread(model, pyEnv, { sheetId, ...toCartesian("A2") }, ["wave"]);
            selectCell(model, "A2");
            await nextTick();
            await click(fixture.querySelector(".o-thread-popover div.o-thread-highlight button"));
            assert.containsOnce(fixture, ".o-threads-side-panel");
        });
    }
);
