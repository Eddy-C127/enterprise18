import { defineMailModels } from "@mail/../tests/mail_test_helpers";
import { expect, test } from "@odoo/hoot";
import { animationFrame } from "@odoo/hoot-mock";
import {
    contains,
    makeServerError,
    mockService,
    mountWithCleanup,
    onRpc,
    patchWithCleanup,
} from "@web/../tests/web_test_helpers";
import { MainComponentsContainer } from "@web/core/main_components_container";

defineMailModels();

test("Shareable error dialog", async () => {
    expect.errors(1);
    patchWithCleanup(navigator.clipboard, {
        async writeText(text) {
            expect.step(text);
        },
    });

    mockService("notification", {
        add: (message, options) => {
            expect(message).toBe("The share URL has been copied to your clipboard.");
            expect(options).toEqual({ type: "success" });
            expect.step("Success notification");
        },
    });

    const error = makeServerError({
        subType: "Odoo Client Error",
        message: "Message",
        errorName: "client error",
    });

    await mountWithCleanup(MainComponentsContainer);
    onRpc("get_support_folder_id", () => 1);
    onRpc("/documents/upload_traceback", () => {
        expect.step("Upload traceback");
    });
    onRpc("documents.share", "web_save", ({ kwargs }) => {
        expect(kwargs.specification).toEqual({ full_url: {} });
        expect.step("Save shareable document");
        return [{ full_url: "test url" }];
    });

    Promise.reject(error);
    await animationFrame();
    expect.verifyErrors(["Message"]);
    expect(".modal-footer button:contains(Close)").toHaveCount(1);
    expect(".modal-footer button:contains(Share)").toHaveCount(1);
    expect(".modal-footer button:contains(Share)").toBeEnabled();
    await contains(".modal-footer button:contains(Share)").click();
    expect(".modal-footer button:contains(Share)").not.toBeEnabled();
    expect.verifySteps([
        "Upload traceback",
        "Save shareable document",
        "test url",
        "Success notification",
    ]);
    expect(".modal-footer .o_field_CopyClipboardChar").toHaveCount(1);
    expect(".modal-footer .o_field_CopyClipboardChar").toHaveText("test url");
    await contains(".o_clipboard_button").click();
    expect.verifySteps(["test url"]);
});
