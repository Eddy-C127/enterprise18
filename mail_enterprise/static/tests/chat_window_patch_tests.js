import { startServer } from "@bus/../tests/helpers/mock_python_environment";

import { Command } from "@mail/../tests/helpers/command";
import { patchUiSize, SIZES } from "@mail/../tests/helpers/patch_ui_size";
import { start } from "@mail/../tests/helpers/test_utils";

import { click as webClick, patchWithCleanup } from "@web/../tests/helpers/utils";
import { click, contains } from "@web/../tests/utils";

import { methods } from "@web_mobile/js/services/core";

QUnit.module("chat_window (patch)");

QUnit.test("'backbutton' event should close chat window", async () => {
    // simulate the feature is available on the current device
    // component must and will be destroyed before the overrideBackButton is unpatched
    patchWithCleanup(methods, {
        overrideBackButton({ enabled }) {},
    });
    const pyEnv = await startServer();
    pyEnv["discuss.channel"].create({
        channel_member_ids: [
            Command.create({
                fold_state: "open",
                partner_id: pyEnv.currentPartnerId,
            }),
        ],
    });
    await start();

    await contains(".o-mail-ChatWindow");
    // simulate 'backbutton' event triggered by the mobile app
    const backButtonEvent = new Event("backbutton");
    document.dispatchEvent(backButtonEvent);
    await contains(".o-mail-ChatWindow", { count: 0 });
});

QUnit.test("[technical] chat window should properly override the back button", async (assert) => {
    // simulate the feature is available on the current device
    // component must and will be destroyed before the overrideBackButton is unpatched
    let overrideBackButton = false;
    patchWithCleanup(methods, {
        overrideBackButton({ enabled }) {
            overrideBackButton = enabled;
        },
    });
    const pyEnv = await startServer();
    pyEnv["discuss.channel"].create({ name: "test" });
    patchUiSize({ size: SIZES.SM });
    await start();

    await click(".o_menu_systray i[aria-label='Messages']");
    await contains(".o-mail-MessagingMenu");
    await click(".o-mail-NotificationItem", { text: "test" });
    await contains(".o-mail-ChatWindow");
    await contains(".o-mail-MessagingMenu", { count: 0 });
    assert.ok(overrideBackButton);

    await click(".o-mail-ChatWindow [title*='Close']");
    await contains(".o-mail-MessagingMenu");
    // The messaging menu is re-open when a chat window is closed,
    // so we need to close it because it overrides the back button too.
    // As long as something overrides the back button, it can't be disabled.
    await webClick(document.body);
    await contains(".o-mail-ChatWindow", { count: 0 });
    await contains(".o-mail-MessagingMenu", { count: 0 });
    assert.notOk(overrideBackButton);
});
