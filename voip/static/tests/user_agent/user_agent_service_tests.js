/* @odoo-module */

import { startServer } from "@bus/../tests/helpers/mock_python_environment";

import { start } from "@mail/../tests/helpers/test_utils";

import { patchWithCleanup } from "@web/../tests/helpers/utils";

QUnit.module("user_agent_service");

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
                defaultSessionDescriptionHandlerFactory() { },
            },
        },
    });
    const pyEnv = await startServer();
    pyEnv["res.users.settings"].create({
        voip_secret: "super secret password",
        voip_username: "1337",
        onsip_auth_username: "when voip_onsip is installed",
        user_id: pyEnv.currentUserId,
    });
    const { env } = await start();
    const config = env.services["voip.user_agent"].sipJsUserAgentConfig;
    assert.equal(config.authorizationPassword, "super secret password");
    assert.equal(
        config.authorizationUsername,
        "onsip_auth_username" in env.services["mail.store"].settings
            ? "when voip_onsip is installed"
            : "1337"
    );
    assert.equal(config.uri.raw.user, "1337");
    assert.equal(config.uri.raw.host, "pbx.example.com");
});
