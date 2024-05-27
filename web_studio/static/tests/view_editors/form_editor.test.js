import { expect, test } from "@odoo/hoot";
import { queryAll } from "@odoo/hoot-dom";
import { onMounted } from "@odoo/owl";

import {
    contains,
    defineModels,
    fields,
    models,
    onRpc,
    patchWithCleanup,
} from "@web/../tests/web_test_helpers";
import { ImageField } from "@web/views/fields/image/image_field";

import {
    mountViewEditor,
    createMockViewResult,
} from "@web_studio/../tests/view_editor_tests_utils";

class Coucou extends models.Model {
    display_name = fields.Char();
    m2o = fields.Many2one({ string: "Product", relation: "product" });
    char_field = fields.Char();

    _records = [];
}

class Partner extends models.Model {
    display_name = fields.Char();
    image = fields.Binary();
    empty_image = fields.Binary();

    _records = [
        {
            id: 1,
            display_name: "jean",
        },
    ];
}

class Product extends models.Model {
    display_name = fields.Char();

    _records = [{ id: 1, display_name: "A very good product" }];
}

defineModels([Coucou, Product, Partner]);

test("Form editor should contains the view and the editor sidebar", async () => {
    await mountViewEditor({
        type: "form",
        resModel: "coucou",
        arch: `<form>
            <sheet>
                <field name="display_name"/>
            </sheet>
        </form>
        `,
    });
    expect(".o_web_studio_editor_manager .o_web_studio_view_renderer").toHaveCount(1);
    expect(".o_web_studio_editor_manager .o_web_studio_sidebar").toHaveCount(1);
});

test("empty form editor", async () => {
    await mountViewEditor({
        type: "form",
        resModel: "coucou",
        arch: `<form/>
        `,
    });
    expect(".o_web_studio_form_view_editor").toHaveCount(1);
    expect(".o_web_studio_form_view_editor .o-web-studio-editor--element-clickable").toHaveCount(0);
    expect(".o_web_studio_form_view_editor .o_web_studio_hook").toHaveCount(0);
});

test("Form editor view buttons can be set to invisible", async () => {
    onRpc("/web_studio/edit_view", async (request) => {
        const { params } = await request.json();
        expect(params.operations[0].target.xpath_info).toEqual([
            {
                tag: "form",
                indice: 1,
            },
            {
                tag: "header",
                indice: 1,
            },
            {
                tag: "button",
                indice: 1,
            },
        ]);
        expect(params.operations[0].new_attrs).toEqual({ invisible: "True" });
        expect.step("edit_view");
    });
    await mountViewEditor({
        type: "form",
        resModel: "coucou",
        arch: `<form>
            <header>
                <button string="Test" type="object" class="oe_highlight"/>
            </header>
            <sheet>
                <field name="display_name"/>
            </sheet>
        </form>
        `,
    });
    expect(".o_web_studio_editor_manager .o_web_studio_view_renderer").toHaveCount(1);
    expect(".o_web_studio_editor_manager .o_web_studio_sidebar").toHaveCount(1);
    await contains(".o_form_renderer .o_statusbar_buttons > button").click();
    await contains(".o_notebook #invisible").click();
    expect(["edit_view"]).toVerifySteps();
});

test("Form editor view buttons label and class are editable from the sidebar", async () => {
    let count = 0;

    onRpc("/web_studio/edit_view", async (request) => {
        const { params } = await request.json();
        expect(params.operations[0].target.xpath_info).toEqual([
            {
                tag: "form",
                indice: 1,
            },
            {
                tag: "header",
                indice: 1,
            },
            {
                tag: "button",
                indice: 1,
            },
        ]);
        if (count === 0) {
            expect(params.operations[0].new_attrs).toEqual({ string: "MyLabel" });
        } else {
            expect(params.operations[1].new_attrs).toEqual({ class: "btn-secondary" });
        }
        count++;
        expect.step("edit_view");
    });
    await mountViewEditor({
        type: "form",
        resModel: "coucou",
        arch: `<form>
            <header>
                <button string="Test" type="object" class="oe_highlight"/>
            </header>
            <sheet>
                <field name="display_name"/>
            </sheet>
        </form>
        `,
    });
    expect(".o_web_studio_editor_manager .o_web_studio_view_renderer").toHaveCount(1);
    expect(".o_web_studio_editor_manager .o_web_studio_sidebar").toHaveCount(1);
    await contains(".o_form_renderer .o_statusbar_buttons > button").click();
    expect("input[name=string]").toHaveValue("Test");
    await contains("input[name=string]").edit("MyLabel");
    expect(["edit_view"]).toVerifySteps();
    expect("input[name=class]").toHaveValue("oe_highlight");
    await contains("input[name=class]").edit("btn-secondary");
    expect(["edit_view"]).toVerifySteps();
});

test("optional field not in form editor", async () => {
    await mountViewEditor({
        type: "form",
        resModel: "coucou",
        arch: `<form>
            <sheet>
                <field name="display_name"/>
            </sheet>
        </form>
        `,
    });
    await contains(".o_web_studio_view_renderer .o_field_char").click();
    expect(".o_web_studio_sidebar_optional_select").toHaveCount(0);
});

test("many2one field edition", async () => {
    onRpc("/web_studio/get_studio_view_arch", () => {
        return { studio_view_arch: "" };
    });
    onRpc("get_formview_action", () => {
        throw new Error("The many2one form view should not be opened");
    });
    await mountViewEditor({
        type: "form",
        resModel: "coucou",
        arch: `<form>
            <sheet>
                <field name="m2o"/>
            </sheet>
        </form>
        `,
    });
    expect(".o_web_studio_form_view_editor .o-web-studio-editor--element-clickable").toHaveCount(1);
    await contains(
        ".o_web_studio_form_view_editor .o-web-studio-editor--element-clickable"
    ).click();
    expect(queryAll(".o_web_studio_sidebar .o_web_studio_property").length > 0).toBe(true);
    expect(".o_web_studio_form_view_editor .o-web-studio-editor--element-clickable").toHaveClass(
        "o-web-studio-editor--element-clicked"
    );
});

test("image field is the placeholder when record is empty", async () => {
    await mountViewEditor({
        type: "form",
        resModel: "partner",
        arch: `<form>
            <sheet>
                <field name='empty_image' widget='image'/>
            </sheet>
        </form>
        `,
    });
    expect(".o_web_studio_form_view_editor .o_field_image").toHaveCount(1);
    expect(".o_web_studio_form_view_editor .o_field_image img").toHaveAttribute(
        "data-src",
        "/web/static/img/placeholder.png",
        {
            message: "default image in empty record should be the placeholder",
        }
    );
});

test("image field edition (change size)", async () => {
    onRpc("/web_studio/edit_view", () => {
        const newArch = `
                <form>
                    <sheet>
                        <field name='image' widget='image' options='{"size":[0, 270],"preview_image":"coucou"}'/>
                    </sheet>
                </form>
            `;
        return createMockViewResult("form", newArch, Partner);
    });

    patchWithCleanup(ImageField.prototype, {
        setup() {
            super.setup();
            onMounted(() => {
                expect.step(
                    `image, width: ${this.props.width}, height: ${this.props.height}, previewImage: ${this.props.previewImage}`
                );
            });
        },
    });
    await mountViewEditor({
        type: "form",
        resModel: "partner",
        arch: `
            <form>
                <sheet>
                    <field name='image' widget='image' options='{"size":[0, 90],"preview_image":"coucou"}'/>
                </sheet>
            </form>
        `,
    });
    expect(".o_web_studio_form_view_editor .o_field_image").toHaveCount(1);
    expect(["image, width: undefined, height: 90, previewImage: coucou"]).toVerifySteps({
        message: "the image should have been fetched",
    });
    await contains(".o_web_studio_form_view_editor .o_field_image").click();
    expect(".o_web_studio_property_size").toHaveCount(1);
    expect(".o_web_studio_property_size .text-start").toHaveText("Small");
    expect(".o_web_studio_form_view_editor .o_field_image").toHaveClass(
        "o-web-studio-editor--element-clicked"
    );
    await contains(".o_web_studio_property_size button").click();
    await contains(".o_select_menu_item_label:contains(Large)").click();
    expect(["image, width: undefined, height: 270, previewImage: coucou"]).toVerifySteps({
        message: "the image should have been fetched again",
    });
    expect(".o_web_studio_property_size .text-start").toHaveText("Large");
});

test("image size can be unset from the selection", async () => {
    let editViewCount = 0;

    onRpc("/web_studio/edit_view", () => {
        editViewCount++;
        let newArch;
        if (editViewCount === 1) {
            newArch = `<form>
                <sheet>
                    <field name='image' widget='image' class='oe_avatar' options='{"preview_image": "image"}'/>
                    <div class='oe_title'>
                        <field name='display_name'/>
                    </div>
                </sheet>
            </form>`;
        }
        return createMockViewResult("form", newArch, Partner);
    });

    await mountViewEditor({
        type: "form",
        resModel: "partner",
        arch: `<form>
            <sheet>
                <field name='image' widget='image' class='oe_avatar' options='{"preview_image": "image", "size": [0,90]}'/>
                <div class='oe_title'>
                    <field name='display_name'/>
                </div>
            </sheet>
        </form>`,
    });
    expect('.o_field_widget.oe_avatar[name="image"]').toHaveCount(1);
    await contains(".o_field_widget[name='image']").click();
    expect(".o_web_studio_property_size .text-start").toHaveText("Small");
    await contains(".o_web_studio_property_size .o_select_menu_toggler_clear").click();
    expect(".o_web_studio_property_size .o_select_menu").toHaveText("");
});

test("signature field edition (change full_name)", async () => {
    let editViewCount = 0;
    let newFieldName;

    onRpc("/web_studio/edit_view", async (request) => {
        const { params } = await request.json();
        editViewCount++;
        let newArch;
        if (editViewCount === 1) {
            expect(params.operations[0].node.attrs.widget).toBe("signature", {
                message: "'signature' widget should be there on field being dropped",
            });
            newFieldName = params.operations[0].node.field_description.name;
            newArch = `
                <form>
                    <group>
                        <field name='display_name'/>
                        <field name='m2o'/>
                        <field name='${newFieldName}' widget='signature'/>
                    </group>
                </form>
                `;
            Coucou._fields[newFieldName] = fields.Binary({
                string: "Signature",
            });
            return createMockViewResult("form", newArch, Coucou, true);
        } else if (editViewCount === 2) {
            expect(params.operations[1].new_attrs.options).toBe('{"full_name":"display_name"}', {
                message: "correct options for 'signature' widget should be passed",
            });
            newArch = `
                <form>
                    <group>
                        <field name='display_name'/>
                        <field name='m2o'/>
                        <field name='${newFieldName}' widget='signature' options='{"full_name": "display_name"}'/>
                    </group>
                </form>
                `;
        } else if (editViewCount === 3) {
            expect(params.operations[2].new_attrs.options).toBe('{"full_name":"m2o"}', {
                message: "correct options for 'signature' widget should be passed",
            });
            newArch = `
                <form>
                    <group>
                        <field name='display_name'/>
                        <field name='m2o'/>
                        <field name='${newFieldName}' widget='signature' options='{"full_name": "m2o"}'/>
                    </group>
                </form>
                `;
        }
        return createMockViewResult("form", newArch, Coucou);
    });
    await mountViewEditor({
        type: "form",
        resModel: "coucou",
        arch: `
            <form>
                <group>
                    <field name='display_name'/>
                    <field name='m2o'/>
                </group>
            </form>
        `,
    });
    await contains(".o_web_studio_new_fields .o_web_studio_field_signature").dragAndDrop(
        ".o_inner_group .o_web_studio_hook:first-child"
    );
    expect(".o_web_studio_form_view_editor .o_signature").toHaveCount(1);
    await contains(".o_web_studio_form_view_editor .o_signature").click();
    expect(".o_web_studio_property_full_name .o-dropdown").toHaveCount(1);
    expect(".o_web_studio_property_full_name button").toHaveText("", {
        message: "the auto complete field should be empty by default",
    });
    await contains(".o_web_studio_property_full_name button").click();
    await contains(".o_select_menu_item_label:contains(Name)").click();
    expect(".o_web_studio_property_full_name button").toHaveText("Display name");
    await contains(".o_web_studio_property_full_name button").click();
    await contains(".o_select_menu_item_label:contains(Product)").click();
    expect(".o_web_studio_property_full_name button").toHaveText("Product");
});

test("integer field should come with 0 as default value", async () => {
    onRpc("/web_studio/edit_view", async (request) => {
        const { params } = await request.json();
        expect.step("edit_view");
        expect(params.operations[0].node.field_description.type).toBe("integer");
        expect(params.operations[0].node.field_description.default_value).toBe("0");
    });

    await mountViewEditor({
        type: "form",
        resModel: "coucou",
        arch: `
            <form>
                <group>
                    <field name='display_name'/>
                </group>
            </form>`,
    });
    await contains(".o_web_studio_new_fields .o_web_studio_field_integer").dragAndDrop(
        ".o_web_studio_hook[data-position=before]"
    );
    expect(["edit_view"]).toVerifySteps();
});
test("supports multiple occurences of field", async () => {
    await mountViewEditor({
        type: "form",
        resModel: "coucou",
        arch: `<form><group>
                <field name="display_name" widget="phone" options="{'enable_sms': false}" />
                <field name="display_name" invisible="1" />
            </group></form>`,
    });
    expect(
        ".o_web_studio_form_view_editor .o_inner_group .o-web-studio-editor--element-clickable"
    ).toHaveCount(1);
    await contains(".o_web_studio_sidebar .o_notebook_headers .nav-link:contains(View)").click();
    await contains(".o_web_studio_sidebar #show_invisible").click();
    expect(
        ".o_web_studio_form_view_editor .o_inner_group .o-web-studio-editor--element-clickable"
    ).toHaveCount(2);
    await contains(
        ".o_web_studio_form_view_editor .o_wrap_field:nth-child(2) .o-web-studio-editor--element-clickable"
    ).click();
    // Would be true if not present in node's options
    expect(".o_web_studio_sidebar input[name='enable_sms']").not.toBeChecked();
    await contains(
        ".o_web_studio_form_view_editor .o_wrap_field:nth-child(3) .o-web-studio-editor--element-clickable"
    ).click();
    expect(".o_web_studio_sidebar input[name='invisible']").toBeChecked();
});
