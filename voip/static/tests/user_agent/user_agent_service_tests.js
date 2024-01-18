/* @odoo-module */

import { startServer } from "@bus/../tests/helpers/mock_python_environment";

import { start } from "@mail/../tests/helpers/test_utils";

import { patchWithCleanup } from "@web/../tests/helpers/utils";
import { assertSteps, step } from "@web/../tests/utils";

QUnit.module("user_agent_service");

// allow test data to be overridden in other modules
export const settingsData = {
    voip_secret: "super secret password",
    voip_username: "1337",
};
export const expectedValues = {
    authorizationUsername: settingsData.voip_username,
};

QUnit.test("SIP.js user agent configuration is set correctly.", async (assert) => {
    patchWithCleanup(window, {
        SIP: {
            UserAgent: {
                makeURI(uri) {
                    const [, scheme, user, host, port] = uri.match(
                        /([^:]+):([^@]+)@([^:]+):?(\d+)?/
                    );
                    const raw = { host, port, scheme, user };
                    return { raw };
                },
            },
            Web: {
                defaultSessionDescriptionHandlerFactory() {},
            },
        },
    });
    const pyEnv = await startServer();
    pyEnv["res.users.settings"].create({
        ...settingsData,
        user_id: pyEnv.currentUserId,
    });
    const { env } = await start({
        async mockRPC(route, args, originalRpc) {
            if (route === "/mail/action" && args.init_messaging) {
                const res = await originalRpc(...arguments);
                step(`/mail/action - ${JSON.stringify(args)}`);
                return res;
            }
        },
    });
    await assertSteps(['/mail/action - {"init_messaging":true,"failures":true}']);
    await new Promise(setTimeout);
    // check after init messaging to wait for data to be received
    const config = env.services["voip.user_agent"].sipJsUserAgentConfig;
    assert.equal(config.authorizationPassword, "super secret password");
    assert.equal(config.authorizationUsername, expectedValues.authorizationUsername);
    assert.equal(config.uri.raw.user, "1337");
    assert.equal(config.uri.raw.host, "pbx.example.com");
});
