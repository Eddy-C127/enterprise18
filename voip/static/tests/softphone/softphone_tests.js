import { serverState, startServer } from "@bus/../tests/helpers/mock_python_environment";

import { start } from "@mail/../tests/helpers/test_utils";

import { translatedTerms } from "@web/core/l10n/translation";
import { patchWithCleanup } from "@web/../tests/helpers/utils";
import { click, contains } from "@web/../tests/utils";

QUnit.module("softphone");

QUnit.test("Clicking on top bar when softphone is unfolded folds the softphone.", async () => {
    await start();
    await click(".o_menu_systray button[title='Open Softphone']");
    await contains(".o-voip-Softphone-content");
    await click(".o-voip-Softphone-topbar");
    await contains(".o-voip-Softphone-content", { count: 0 });
});

QUnit.test("Clicking on top bar when softphone is folded unfolds the softphone.", async () => {
    await start();
    await click(".o_menu_systray button[title='Open Softphone']");
    await click(".o-voip-Softphone-topbar"); // fold
    await click(".o-voip-Softphone-topbar");
    await contains(".o-voip-Softphone-content");
});

QUnit.test("Clicking on close button closes the softphone.", async () => {
    await start();
    await click(".o_menu_systray button[title='Open Softphone']");
    await contains(".o-voip-Softphone");
    await click(".o-voip-Softphone button[title='Close']");
    await contains(".o-voip-Softphone", { count: 0 });
});

QUnit.test("Search bar is focused after opening the softphone.", async () => {
    await start();
    await click(".o_menu_systray button[title='Open Softphone']");
    await contains("input[placeholder='Search']:focus");
});

QUnit.test("Search bar is focused after unfolding the softphone.", async () => {
    await start();
    await click(".o_menu_systray button[title='Open Softphone']");
    await click(".o-voip-Softphone-topbar"); // fold
    await click(".o-voip-Softphone-topbar"); // unfold
    await contains("input[placeholder='Search']:focus");
});

QUnit.test("“Next activities” is the active tab by default.", async () => {
    await start();
    await click(".o_menu_systray button[title='Open Softphone']");
    await contains(".nav-link.active", { text: "Next Activities" });
});

QUnit.test("Clicking on a tab makes it the active tab.", async () => {
    await start();
    await click(".o_menu_systray button[title='Open Softphone']");
    await click(".nav-link", { text: "Contacts" });
    await contains(".nav-link.active", { text: "Contacts" });
    await contains(".nav-link.active");
});

QUnit.test("Click on the “Numpad button” to open and close the numpad.", async () => {
    await start();
    await click(".o_menu_systray button[title='Open Softphone']");
    await click("button[title='Open Numpad']");
    await contains(".o-voip-Numpad");
    await click("button[title='Close Numpad']");
    await contains(".o-voip-Numpad", { count: 0 });
});

QUnit.test(
    "The softphone top bar text is “VoIP” as long as there is no missed calls.",
    async () => {
        await start();
        await click(".o_menu_systray button[title='Open Softphone']");
        await contains(".o-voip-Softphone-topbar", { text: "VoIP" });
    }
);

QUnit.test(
    "The softphone automatically opens folded when there is at least 1 missed call.",
    async () => {
        const pyEnv = await startServer();
        pyEnv["voip.call"].create({ state: "missed", user_id: serverState.userId });
        await start();
        await contains(".o-voip-Softphone"); // it's displayed…
        await contains(".o-voip-Softphone-content", { count: 0 }); // but it's folded
    }
);

QUnit.test(
    "The softphone top bar text is “1 missed call” when there is 1 missed call.",
    async () => {
        const pyEnv = await startServer();
        pyEnv["voip.call"].create({ state: "missed", user_id: serverState.userId });
        await start();
        await contains(".o-voip-Softphone-topbar", { text: "1 missed call" });
    }
);

QUnit.test(
    "The softphone top bar text allows a specific translation for the dual grammatical number.",
    async () => {
        const pyEnv = await startServer();
        patchWithCleanup(translatedTerms, { "2 missed calls": "2 مكالمة فائتة" });
        pyEnv["voip.call"].create({ state: "missed", user_id: serverState.userId });
        pyEnv["voip.call"].create({ state: "missed", user_id: serverState.userId });
        await start();
        await contains(".o-voip-Softphone-topbar", { text: "2 مكالمة فائتة" });
    }
);

QUnit.test(
    "The softphone top bar text is “513 missed calls” when there is 513 missed calls",
    async () => {
        const pyEnv = await startServer();
        for (let i = 0; i < 513; i++) {
            pyEnv["voip.call"].create({ state: "missed", user_id: serverState.userId });
        }
        await start();
        await contains(".o-voip-Softphone-topbar", { text: "513 missed calls" });
    }
);

QUnit.test("The cursor when hovering over the top bar has “pointer” style", async (assert) => {
    await start();
    await click(".o_menu_systray button[title='Open Softphone']");
    await contains(".o-voip-Softphone-topbar");
    assert.strictEqual(getComputedStyle($(".o-voip-Softphone-topbar")[0]).cursor, "pointer");
});

QUnit.test("Using VoIP in prod mode without configuring the server shows an error", async () => {
    const pyEnv = await startServer();
    const providerId = pyEnv["voip.provider"].create({
        mode: "prod",
        name: "Axivox super cool",
        pbx_ip: "",
        ws_server: "",
    });
    pyEnv["res.users"].write([pyEnv.currentUserId], { voip_provider_id: providerId });
    await start();
    await click(".o_menu_systray button[title='Open Softphone']");
    await contains(".o-voip-Softphone-error");
});
