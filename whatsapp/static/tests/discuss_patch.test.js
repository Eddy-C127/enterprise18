import {
    SIZES,
    click,
    contains,
    openDiscuss,
    patchUiSize,
    start,
    startServer,
} from "@mail/../tests/mail_test_helpers";
import { describe, test } from "@odoo/hoot";
import { defineWhatsAppModels } from "@whatsapp/../tests/whatsapp_test_helpers";

describe.current.tags("desktop");
defineWhatsAppModels();

test("Basic topbar rendering for whatsapp channels", async () => {
    const pyEnv = await startServer();
    const channelId = pyEnv["discuss.channel"].create({
        name: "WhatsApp 1",
        channel_type: "whatsapp",
    });
    await start();
    await openDiscuss(channelId);
    await contains(".o-mail-Discuss-header .o-mail-ThreadIcon .fa-whatsapp");
    await contains(".o-mail-Discuss-threadName:disabled", { value: "WhatsApp 1" });
    await contains(".o-mail-Discuss-header button[title='Add Users']");
    await contains(".o-mail-Discuss-header button[name='call']", { count: 0 });
    await contains(".o-mail-Discuss-header button[name='settings']", { count: 0 });
});

test("Invite users into whatsapp channel", async () => {
    const pyEnv = await startServer();
    const channelId = pyEnv["discuss.channel"].create({
        name: "WhatsApp 1",
        channel_type: "whatsapp",
    });
    const partnerId = pyEnv["res.partner"].create({ name: "WhatsApp User" });
    pyEnv["res.users"].create({ partner_id: partnerId });
    await start();
    await openDiscuss(channelId);
    await click(".o-mail-Discuss-header button[title='Add Users']");
    await click(".o-discuss-ChannelInvitation-selectable");
    await click("button[title='Invite']:enabled");
    await contains(".o_mail_notification", { text: "invited WhatsApp User to the channel" });
});

test("Mobile has WhatsApp category", async () => {
    const pyEnv = await startServer();
    patchUiSize({ size: SIZES.SM });
    pyEnv["discuss.channel"].create({ name: "WhatsApp 1", channel_type: "whatsapp" });
    await start();
    await openDiscuss();
    await click(".o-mail-MessagingMenu-navbar button", { text: "WhatsApp" });
    await contains(".o-mail-NotificationItem", { text: "WhatsApp 1" });
});
