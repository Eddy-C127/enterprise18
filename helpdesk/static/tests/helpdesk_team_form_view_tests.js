/** @odoo-module */

import { click, clickSave, getFixture, patchWithCleanup } from "@web/../tests/helpers/utils";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";

let target, serverData;

async function mockCheckFeatureEnabled() {
    let use_sla = false;
    let use_timesheet = false;
    let use_alias = false;

    for (const record of serverData.models.team.records) {
        if (record.use_sla) {
            use_sla = true;
        }
        if (record.use_timesheet) {
            use_timesheet = true;
        }
        if (record.use_alias) {
            use_alias = true;
        }
    }
    return { use_sla, use_timesheet, use_alias };
}

QUnit.module("Views", (hooks) => {
    hooks.beforeEach(() => {
        serverData = {
            models: {
                team: {
                    fields: {
                        name: { string: "Name", type: "char" },
                        use_sla: { string: "Use SLA", type: "boolean" },
                        use_alias: { string: "Use Alias", type: "boolean" },
                        use_timesheet: { string: "Use Timesheet", type: "boolean" },
                    },
                    records: [
                        {
                            id: 1,
                            name: "Team 1",
                            use_sla: true,
                            use_alias: true,
                        },
                        { id: 2, name: "Team 2", use_alias: true },
                    ],
                },
            },
            views: {
                "team,false,form": `
                    <form js_class="helpdesk_team_form">
                        <sheet>
                            <group>
                                <field name="name"/>
                                <field name="use_sla"/>
                                <field name="use_alias"/>
                                <field name="use_timesheet"/>
                            </group>
                        </sheet>
                    </form>
                `,
            },
            async mockRPC(route, args) {},
        };
        target = getFixture();
        setupViewRegistries();
    });

    QUnit.module("Helpdesk Form View");

    QUnit.test("reload the page when use_sla is disabled in all teams", async (assert) => {
        const helpdeskForm = await makeView({
            serverData,
            type: "form",
            resModel: "team",
            resId: 1,
            async mockRPC(route, { method, args }) {
                if (method === "check_features_enabled") {
                    assert.step(method);
                    if (args.length) {
                        assert.deepEqual(args[0], ["use_sla"]);
                    }
                    return mockCheckFeatureEnabled();
                } else if (method === "check_modules_to_install") {
                    assert.step(method);
                    assert.deepEqual(args[0], ["use_sla"]);
                    return false;
                } else if (method === "web_save") {
                    assert.step(method);
                } else if (route === "/web/session/get_session_info") {
                    return {};
                }
            },
        });

        patchWithCleanup(helpdeskForm.env.services.action, {
            doAction(action) {
                if (action === "reload_context") {
                    assert.step("reload_context");
                }
                super.doAction(action);
            },
        });

        await click(target, "div[name='use_sla'] input");
        await clickSave(target);
        assert.verifySteps([
            "check_features_enabled",
            "check_modules_to_install",
            "web_save",
            "check_features_enabled",
            "reload_context",
        ]);
    });

    QUnit.test(
        "reload the page when the feature use_timesheet is enabled in one team",
        async (assert) => {
            const helpdeskForm = await makeView({
                serverData,
                type: "form",
                resModel: "team",
                resId: 1,
                async mockRPC(route, { method, args }) {
                    if (method === "check_features_enabled") {
                        assert.step(method);
                        return mockCheckFeatureEnabled();
                    } else if (method === "check_modules_to_install") {
                        assert.step(method);
                        assert.deepEqual(args[0], ["use_timesheet"]);
                        return true;
                    } else if (method === "web_save") {
                        assert.step(method);
                    } else if (route === "/web/session/get_session_info") {
                        return {};
                    }
                },
            });

            patchWithCleanup(helpdeskForm.env.services.action, {
                doAction(action) {
                    if (action === "reload_context") {
                        assert.step("reload_context");
                    }
                    super.doAction(action);
                },
            });

            await click(target, "div[name='use_timesheet'] input");
            await clickSave(target);
            assert.verifySteps([
                "check_features_enabled",
                "check_modules_to_install",
                "web_save",
                "reload_context",
            ]);
        }
    );

    QUnit.test(
        "reload the page when the feature use_timesheet is enabled in all teams",
        async (assert) => {
            let mockHelpdeskTimesheetModuleInstall = false;
            const helpdeskForm = await makeView({
                serverData,
                type: "form",
                resModel: "team",
                resIds: [1, 2],
                resId: 1,
                async mockRPC(route, { method, args }) {
                    if (method === "check_features_enabled") {
                        assert.step(method);
                        if (args.length) {
                            assert.deepEqual(args[0], ["use_timesheet"]);
                        }
                        return mockCheckFeatureEnabled();
                    } else if (method === "check_modules_to_install") {
                        assert.step(method);
                        assert.deepEqual(args[0], ["use_timesheet"]);
                        if (mockHelpdeskTimesheetModuleInstall) {
                            return false;
                        } else {
                            mockHelpdeskTimesheetModuleInstall = true;
                            return true;
                        }
                    } else if (method === "web_save") {
                        assert.step(method);
                    } else if (route === "/web/session/get_session_info") {
                        return {};
                    }
                },
            });

            patchWithCleanup(helpdeskForm.env.services.action, {
                doAction(action) {
                    if (action === "reload_context") {
                        assert.step("reload_context");
                    }
                    super.doAction(action);
                },
            });

            await click(target, "div[name='use_timesheet'] input");
            await click(target.querySelector(".o_pager_next"));
            await click(target, "div[name='use_timesheet'] input");
            await clickSave(target);
            // Check we reload only the first time we enable the timesheet feature in a helpdesk team
            assert.verifySteps([
                "check_features_enabled",
                "check_modules_to_install",
                "web_save",
                "reload_context",
                "web_save",
            ]);
        }
    );

    QUnit.test("reload when the feature is disabled in all teams", async (assert) => {
        const helpdeskForm = await makeView({
            serverData,
            type: "form",
            resModel: "team",
            resIds: [1, 2],
            resId: 1,
            async mockRPC(route, { method, args }) {
                if (method === "check_features_enabled") {
                    assert.step(method);
                    if (args.length) {
                        assert.deepEqual(args[0], ["use_alias"]);
                    }
                    return mockCheckFeatureEnabled();
                } else if (method === "check_modules_to_install") {
                    assert.step(method);
                    assert.deepEqual(args[0], ["use_alias"]);
                    return false;
                } else if (method === "web_save") {
                    assert.step(method);
                } else if (route === "/web/session/get_session_info") {
                    return {};
                }
            },
        });

        patchWithCleanup(helpdeskForm.env.services.action, {
            doAction(action) {
                if (action === "reload_context") {
                    assert.step("reload_context");
                }
                super.doAction(action);
            },
        });

        await click(target, "div[name='use_alias'] input");
        await clickSave(target);
        await click(target.querySelector(".o_pager_next"));
        await click(target, "div[name='use_alias'] input");
        await clickSave(target);
        assert.verifySteps([
            "check_features_enabled",
            "check_modules_to_install",
            "web_save",
            "check_features_enabled",
            "check_modules_to_install",
            "web_save",
            "check_features_enabled",
            "reload_context",
        ]);
    });
});
