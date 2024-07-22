import { expect, test } from "@odoo/hoot";
import { animationFrame } from "@odoo/hoot-mock";
import { contains, defineModels, fields, models, onRpc } from "@web/../tests/web_test_helpers";

import {
    createMockViewResult,
    disableHookAnimation,
    mountViewEditor,
} from "@web_studio/../tests/view_editor_tests_utils";

class Coucou extends models.Model {
    display_name = fields.Char();
    m2o = fields.Many2one({ relation: "product" });
    char_field = fields.Char();
    priority = fields.Selection({
        selection: [
            ["1", "Low"],
            ["2", "Medium"],
            ["3", "High"],
        ],
    });

    _records = [];
}

class Partner extends models.Model {
    display_name = fields.Char();
    image = fields.Binary();

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

test("template without t-name='kanban-card' load the legacy kanban editor", async () => {
    await mountViewEditor({
        type: "kanban",
        resModel: "coucou",
        arch: `<kanban>
        <templates>
            <t t-name="kanban-box">
                <div class="oe_kanban_global_click">
                    <field name="char_field"/>
                </div>
            </t>
        </templates>
    </kanban>
    `,
    });
    expect(".o_web_studio_kanban_view_editor_legacy").toHaveCount(1);
    expect(".o_kanban_record .o_web_studio_kanban_hook").toHaveCount(4, {
        message: "hooks are present inside the card",
    });
});

test("empty kanban editor", async () => {
    await mountViewEditor({
        type: "kanban",
        resModel: "coucou",
        arch: `<kanban>
        <templates>
            <t t-name="kanban-card">
            </t>
        </templates>
    </kanban>
    `,
    });
    expect(".o_kanban_renderer").toHaveCount(1);
});

test("templates without a main node are wrapped in a main node by the editor", async () => {
    await mountViewEditor({
        type: "kanban",
        resModel: "coucou",
        arch: `<kanban>
        <templates>
            <t t-name="kanban-card">
                <div class="d-flex mb-1 h5">
                    <field name="char_field"/>
                </div>
            </t>
        </templates>
    </kanban>
    `,
    });
    expect("article.o_kanban_record > main").toHaveCount(1);
    expect("article.o_kanban_record > main").toHaveAttribute("studioxpath", null, {
        message: "no xpath is set on this element has it doesn't exist in the original template",
    });
    expect("article.o_kanban_record > .o_web_studio_hook[data-type=kanbanAsideHook]").toHaveCount(
        2,
        {
            message: "hooks are present around the element to drop an aside",
        }
    );
});

test("kanban structures display depends if element is present in the view", async () => {
    onRpc("/web_studio/edit_view", () => {
        // in this test, we result with a completely different template
        const newArch = `
                <kanban>
                    <templates>
                        <t t-name="kanban-card">
                            <widget name="web_ribbon" title="Ribbon"/>
                            <aside>
                            </aside>
                            <main>
                                <field name="char_field"/>
                            </main>
                        </t>
                    </templates>
                </kanban>
            `;
        return createMockViewResult("kanban", newArch, Coucou);
    });
    await mountViewEditor({
        type: "kanban",
        resModel: "coucou",
        arch: `<kanban>
            <templates>
                <t t-name="kanban-card">
                    <field name="char_field"/>
                </t>
                <t t-name="kanban-menu">
                    <a>Item</a>
                </t>
            </templates>
        </kanban>
    `,
    });
    await contains(".o_web_studio_new").click();
    expect(".o_web_studio_field_menu").toHaveCount(0);
    expect(".o_web_studio_field_aside").toHaveCount(1);
    expect(".o_web_studio_field_footer").toHaveCount(1);
    expect(".o_web_studio_field_ribbon").toHaveCount(1);
    await contains(".o_web_studio_new_components .o_web_studio_field_aside").dragAndDrop(
        ".o_web_studio_hook[data-type=kanbanAsideHook]"
    );
    await contains(".o_web_studio_new").click();
    expect(".o_web_studio_field_menu").toHaveCount(1);
    expect(".o_web_studio_field_aside").toHaveCount(0);
    expect(".o_web_studio_field_footer").toHaveCount(1);
    expect(".o_web_studio_field_ribbon").toHaveCount(0);
});

test("hooks are placed inline around fields displayed in a span", async () => {
    await mountViewEditor({
        type: "kanban",
        resModel: "coucou",
        arch: `<kanban>
        <templates>
            <t t-name="kanban-card">
                <main>
                    <h3>Card</h3>
                    <div class="inline">
                        <field name="display_name"/>,
                        <field name="char_field"/>
                    </div>
                    <div class="block">
                        <field name="display_name" widget="char"/>,
                        <field name="char_field" widget="char"/>
                    </div>
                </main>
            </t>
        </templates>
    </kanban>
    `,
    });
    expect("article.o_kanban_record > main").toHaveCount(1);
    expect(".inline span.o_web_studio_hook[data-type=field]").toHaveCount(4, {
        message: "hooks are using a span instead of a div",
    });
    expect(".block div.o_web_studio_hook[data-type=field]").toHaveCount(4, {
        message: "hooks are using a div around field components",
    });
});

test("card without main should be able to add a footer", async () => {
    await mountViewEditor({
        type: "kanban",
        resModel: "coucou",
        arch: `<kanban>
        <templates>
            <t t-name="kanban-card">
                <h3>Card</h3>
                <div class="inline">
                    <field name="display_name"/>,
                    <field name="char_field"/>
                </div>
            </t>
        </templates>
    </kanban>
    `,
    });
    expect("main .o_web_studio_hook[data-structures=footer]").toHaveCount(1);
});

test("adding an aside element calls the right operation", async () => {
    onRpc("/web_studio/edit_view", async (request) => {
        const { params } = await request.json();
        expect(params.operations[0].type).toBe("kanban_wrap_main");
        // server side, this operation would wrap the content inside a <main> node
        const newArch = `
                <kanban>
                    <templates>
                        <t t-name="kanban-card">
                            <main>
                                <t>
                                    <h3>Card</h3>
                                    <div class="inline">
                                        <field name="display_name"/>,
                                        <field name="char_field"/>
                                    </div>
                                </t>
                            </main>
                        </t>
                    </templates>
                </kanban>
            `;
        return createMockViewResult("kanban", newArch, Coucou);
    });
    await mountViewEditor({
        type: "kanban",
        resModel: "coucou",
        arch: `<kanban>
        <templates>
            <t t-name="kanban-card">
                <h3>Card</h3>
            </t>
        </templates>
    </kanban>
    `,
    });
    await contains(".o_web_studio_new").click();
    await contains(".o_web_studio_new_components .o_web_studio_field_aside").dragAndDrop(
        ".o_web_studio_hook[data-type=kanbanAsideHook]"
    );
});

test("adding a footer element calls the right operation", async () => {
    onRpc("/web_studio/edit_view", async (request) => {
        const { params } = await request.json();
        expect(params.operations[0].type).toBe("kanban_wrap_main");
        // server side, this operation would wrap the content inside a <main> node
        const newArch = `
                <kanban>
                    <templates>
                        <t t-name="kanban-card">
                            <main>
                                <t>
                                    <h3>Card</h3>
                                </t>
                            </main>
                        </t>
                    </templates>
                </kanban>
            `;
        return createMockViewResult("kanban", newArch, Coucou);
    });
    await mountViewEditor({
        type: "kanban",
        resModel: "coucou",
        arch: `<kanban>
        <templates>
            <t t-name="kanban-card">
                <h3>Card</h3>
            </t>
        </templates>
    </kanban>
    `,
    });
    await contains(".o_web_studio_new").click();
    await contains(".o_web_studio_new_components .o_web_studio_field_footer").dragAndDrop(
        ".o_web_studio_hook[data-type=footer]"
    );
});

test("adding a menu element calls the right operation", async () => {
    onRpc("/web_studio/edit_view", async (request) => {
        const { params } = await request.json();
        expect(params.operations[0].type).toBe("kanban_menu");
    });
    await mountViewEditor({
        type: "kanban",
        resModel: "coucou",
        arch: `<kanban>
        <templates>
            <t t-name="kanban-card">
                <h3>Card</h3>
            </t>
        </templates>
    </kanban>
    `,
    });
    disableHookAnimation();
    await contains(".o_web_studio_new").click();
    const { drop, moveTo } = await contains(
        ".o_web_studio_new_components .o_web_studio_field_menu"
    ).drag();
    await animationFrame();
    await moveTo(".o_web_studio_hook[data-type=t]");
    expect(".o_web_studio_hook[data-type=t]").toHaveClass("o_web_studio_hook_visible");
    await drop();
});

test("adding a colorpicker inside the menu", async () => {
    onRpc("/web_studio/edit_view", async (request) => {
        const { params } = await request.json();
        expect(params.operations[0].type).toBe("kanban_colorpicker");

        Coucou._fields.x_color = fields.Integer({
            string: "Color",
        });
        const newArch = `
                    <kanban>
                        <templates>
                            <t t-name="kanban-card">
                                <h3>Card</h3>
                            </t>
                            <t t-name="kanban-menu">
                                <small>Menu</small>
                                <field name="x_color" widget="kanban_color_picker" />
                            </t>
                        </templates>
                    </kanban>
                `;
        return createMockViewResult("kanban", newArch, Coucou);
    });
    await mountViewEditor({
        type: "kanban",
        resModel: "coucou",
        arch: `<kanban>
        <templates>
            <t t-name="kanban-card">
                <h3>Card</h3>
            </t>
            <t t-name="kanban-menu">
                <small>Menu</small>
            </t>
        </templates>
    </kanban>
    `,
    });
    disableHookAnimation();
    await contains(".o_web_studio_new").click();
    const { drop, moveTo } = await contains(
        ".o_web_studio_new_components .o_web_studio_field_color_picker"
    ).drag();
    await animationFrame();
    await moveTo(".o_web_studio_hook[data-type=t]");
    expect(".o_web_studio_hook[data-type=t]").toHaveClass("o_web_studio_hook_visible");
    await drop();
    expect(".o_dropdown_kanban").toHaveCount(1);
    await contains(".o_dropdown_kanban").click();
    expect(".o_notebook_content h3").toHaveText("Menu");
    await contains(".o_notebook_content .btn-secondary:contains(Color Picker)").click();
    expect(".o_notebook_content h3").toHaveText("Field", {
        message: "it is possible to edit the field with kanban_color_picker widget",
    });
});

test("adding a colorpicker when menu is not present", async () => {
    onRpc("/web_studio/edit_view", async (request) => {
        const { params } = await request.json();
        expect(params.operations[0].type).toBe("kanban_menu");
        expect(params.operations[1].type).toBe("kanban_colorpicker");
        Coucou._fields.x_color = fields.Integer({
            string: "Color",
        });
        const newArch = `
                    <kanban>
                        <templates>
                            <t t-name="kanban-card">
                                <h3>Card</h3>
                            </t>
                            <t t-name="kanban-menu">
                                <field name="x_color" widget="kanban_color_picker" />
                            </t>
                        </templates>
                    </kanban>
                `;
        return createMockViewResult("kanban", newArch, Coucou);
    });
    await mountViewEditor({
        type: "kanban",
        resModel: "coucou",
        arch: `<kanban>
        <templates>
            <t t-name="kanban-card">
                <h3>Card</h3>
            </t>
        </templates>
    </kanban>
    `,
    });
    disableHookAnimation();
    await contains(".o_web_studio_new").click();
    const { drop, moveTo } = await contains(
        ".o_web_studio_new_components .o_web_studio_field_color_picker"
    ).drag();
    await animationFrame();
    await moveTo(".o_web_studio_hook[data-type=t]");
    expect(".o_web_studio_hook[data-type=t]").toHaveClass("o_web_studio_hook_visible");
    await drop();
    expect(".o_dropdown_kanban").toHaveCount(1);
    await contains(".o_dropdown_kanban").click();
    expect(".o_notebook_content h3").toHaveText("Menu");
    await contains(".o_notebook_content .btn-secondary:contains(Color Picker)").click();
    expect(".o_notebook_content h3").toHaveText("Field", {
        message: "it is possible to edit the field with kanban_color_picker widget",
    });
});

test("can_open attribute can be edited from the sidebar", async () => {
    onRpc("/web_studio/edit_view", async (request) => {
        const { params } = await request.json();
        expect(params.operations[0].new_attrs.can_open).toBe(false);
        const newArch = `
            <kanban can_open="false">
                <templates>
                    <t t-name="kanban-card">
                        <h3>Card</h3>
                    </t>
                </templates>
            </kanban>
        `;
        return createMockViewResult("kanban", newArch, Coucou);
    });
    await mountViewEditor({
        type: "kanban",
        resModel: "coucou",
        arch: `<kanban>
        <templates>
            <t t-name="kanban-card">
                <h3>Card</h3>
            </t>
        </templates>
    </kanban>
    `,
    });
    await contains(".o_web_studio_view").click();
    expect("input[id=can_open]").toHaveCount(1);
    expect("input[id=can_open]").toBeChecked({
        message: "option is checked by default when the arch does not specify",
    });
    await contains("input[id=can_open]").click();
    expect("input[id=can_open]").not.toBeChecked();
});

test("buttons can be edited when being selected", async () => {
    await mountViewEditor({
        type: "kanban",
        resModel: "coucou",
        arch: `<kanban>
        <templates>
            <t t-name="kanban-card">
                <main>
                    Coucou
                    <footer>
                        <a type="action" name="my_first_action" class="btn btn-link" role="button">
                            <i class="fa fa-recycle"/> Do something
                        </a>
                        <button type="action" name="my_last_action" class="btn btn-primary" role="button">
                            Click me
                        </button>
                    </footer>
                </main>
            </t>
        </templates>
    </kanban>
    `,
    });
    expect("footer .o-web-studio-editor--element-clickable").toHaveCount(2);
    await contains("a.o-web-studio-editor--element-clickable").click();
    expect("input[id=class]").toHaveCount(1);
    expect("input[id=name]").toHaveValue("my_first_action");
    await contains("button.o-web-studio-editor--element-clickable").click();
    expect("input[id=class]").toHaveCount(1);
    expect("input[id=name]").toHaveValue("my_last_action");
});
