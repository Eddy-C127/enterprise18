/* @odoo-module */

import { startServer } from "@bus/../tests/helpers/mock_python_environment";

import { start } from "@mail/../tests/helpers/test_utils";

QUnit.module("voip service");

QUnit.test(
    "“hasValidExternalDeviceNumber” is true when an external device number is configured.",
    async (assert) => {
        const pyEnv = await startServer();
        pyEnv["res.users.settings"].create({
            external_device_number: "+247-555-183-184",
            user_id: pyEnv.currentUserId,
        });
        const { env } = await start();
        const { voip } = env.services;
        assert.strictEqual(voip.hasValidExternalDeviceNumber, true);
    }
);

QUnit.test(
    "“hasValidExternalDeviceNumber” is false when no external device number is configured.",
    async (assert) => {
        const { env } = await start();
        const { voip } = env.services;
        assert.strictEqual(voip.hasValidExternalDeviceNumber, false);
    }
);
