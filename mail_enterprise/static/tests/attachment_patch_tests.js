/* @odoo-module */

import { patchUiSize, SIZES } from "@mail/../tests/helpers/patch_ui_size";
import { afterNextRender, click, start, startServer } from "@mail/../tests/helpers/test_utils";

import { patchWithCleanup } from "@web/../tests/helpers/utils";

import { methods } from "web_mobile.core";

QUnit.module("attachment (patch)");

QUnit.test("'backbutton' event should close attachment viewer", async (assert) => {
    patchWithCleanup(methods, {
        overrideBackButton({ enabled }) {},
    });

    patchUiSize({ size: SIZES.SM });
    const pyEnv = await startServer();
    const channelId = pyEnv["discuss.channel"].create({
        channel_type: "channel",
        name: "channel",
    });
    const attachmentId = pyEnv["ir.attachment"].create({
        name: "test.png",
        mimetype: "image/png",
    });
    pyEnv["mail.message"].create({
        attachment_ids: [attachmentId],
        body: "<p>Test</p>",
        model: "discuss.channel",
        res_id: channelId,
    });
    const { openDiscuss } = await start();
    await openDiscuss();
    await click("button:contains(Channel)");
    await click(".o-mail-NotificationItem:contains('channel')");
    await click(".o-mail-AttachmentImage");
    assert.containsOnce($, ".o-FileViewer");
    await afterNextRender(() => {
        const backButtonEvent = new Event("backbutton");
        document.dispatchEvent(backButtonEvent);
    });
    assert.containsNone($, ".o-FileViewer");
});

QUnit.test(
    "[technical] attachment viewer should properly override the back button",
    async (assert) => {
        // simulate the feature is available on the current device
        // component must and will be destroyed before the overrideBackButton is unpatched
        patchWithCleanup(methods, {
            overrideBackButton({ enabled }) {
                assert.step(`overrideBackButton: ${enabled}`);
            },
        });

        patchUiSize({ size: SIZES.SM });
        const pyEnv = await startServer();
        const partnerId = pyEnv["res.partner"].create({ name: "partner 1" });
        const messageAttachmentId = pyEnv["ir.attachment"].create({
            name: "test.png",
            mimetype: "image/png",
        });
        pyEnv["mail.message"].create({
            attachment_ids: [messageAttachmentId],
            body: "<p>Test</p>",
            model: "res.partner",
            res_id: partnerId,
        });
        const { openView } = await start();
        await openView({
            res_id: partnerId,
            res_model: "res.partner",
            views: [[false, "form"]],
        });

        await click(".o-mail-AttachmentImage");
        assert.verifySteps(["overrideBackButton: true"]);

        await click(".o-FileViewer div[aria-label='Close']");
        assert.verifySteps(["overrideBackButton: false"]);
    }
);
