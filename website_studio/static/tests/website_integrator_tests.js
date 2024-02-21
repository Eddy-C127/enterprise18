/** @odoo-module **/
import { click, getFixture, nextTick, patchWithCleanup } from "@web/../tests/helpers/utils";
import { getActionManagerServerData } from "@web/../tests/webclient/helpers";
import { browser } from "@web/core/browser/browser";
import { user } from "@web/core/user";
import { createEnterpriseWebClient } from "@web_enterprise/../tests/helpers";
import { openStudio, registerStudioDependencies } from "@web_studio/../tests/helpers";

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

let serverData;
let target;
QUnit.module("Website Integrator", (hooks) => {
    hooks.beforeEach(() => {
        target = getFixture();
        serverData = getActionManagerServerData();
        registerStudioDependencies();

        serverData.menus = {
            root: { id: "root", children: [1], name: "root", appID: "root" },
            1: {
                id: 1,
                children: [],
                name: "Ponies",
                appID: 1,
                actionID: 8,
                xmlid: "app_1",
            },
        };
    });

    QUnit.test(
        "open list view with sample data gives empty list view in studio",
        async function (assert) {
            serverData.views["pony,false,list"] = `<tree sample="1"><field name="name"/></tree>`;

            await createEnterpriseWebClient({
                serverData,
                mockRPC: (route) => {
                    if (route === "/website_studio/get_forms") {
                        assert.step(route);
                        return Promise.resolve([{ id: 1, name: "partner", url: "/partner" }]);
                    }
                    if (route === "/website_studio/get_website_pages") {
                        assert.step(route);
                        return { websites: [], pages: [] };
                    }
                },
            });
            await nextTick();
            // open app Ponies (act window action)
            await click(target, ".o_app[data-menu-xmlid=app_1]");
            await nextTick();
            await openStudio(target);

            const websiteItem = [...target.querySelectorAll(".o_menu_sections a")].filter(
                (el) => el.textContent === "Website"
            )[0];
            await click(websiteItem);
            assert.containsN(target, ".o_website_studio_form .o_web_studio_thumbnail_item", 2);
            const websiteStudioForms = target.querySelectorAll(
                ".o_website_studio_form .o_web_studio_thumbnail_item"
            );
            assert.strictEqual(websiteStudioForms[0].innerText, "New Form");
            assert.strictEqual(websiteStudioForms[1].innerText, "Partner");

            assert.verifySteps(["/website_studio/get_forms", "/website_studio/get_website_pages"]);
        }
    );

    QUnit.test("create new form", async (assert) => {
        let isDesigner = false;
        patchWithCleanup(user, {
            hasGroup: async () => isDesigner,
        });

        patchWithCleanup(browser, {
            open: (...args) => {
                assert.step(["open", ...args].join(" "));
                return { closed: false };
            },
        });

        await createEnterpriseWebClient({
            serverData,
            mockRPC: (route) => {
                if (route === "/website_studio/get_forms") {
                    return Promise.resolve([]);
                }
                if (route === "/website_studio/get_website_pages") {
                    return { websites: [], pages: [] };
                }
                if (route === "/website_studio/create_form") {
                    assert.step("create_form");
                    return "/some/url";
                }
            },
        });
        await nextTick();
        // open app Ponies (act window action)
        await click(target, ".o_app[data-menu-xmlid=app_1]");
        await nextTick();
        await openStudio(target);
        const websiteItem = [...target.querySelectorAll(".o_menu_sections a")].filter(
            (el) => el.textContent === "Website"
        )[0];
        await click(websiteItem);
        assert.strictEqual(
            target
                .querySelector(".o_website_studio_form .o_website_studio_new_card img")
                .getAttribute("data-alt"),
            "App icon"
        );
        await click(target, ".o_website_studio_form .o_website_studio_new_card");
        assert.containsOnce(target, ".o_notification");
        const notifText = target.querySelector(
            ".o_notification .o_notification_content"
        ).textContent;
        assert.ok(
            notifText.includes(
                "Sorry, only users with the following access level are currently allowed to do that"
            )
        );

        isDesigner = true;
        await click(websiteItem);
        await click(target, ".o_website_studio_form .o_website_studio_new_card");
        assert.verifySteps(["create_form", "open /some/url?enable_editor=1 _blank"]);
    });
});
