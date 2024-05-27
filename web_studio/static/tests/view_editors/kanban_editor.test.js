import { expect, test } from "@odoo/hoot";
import { defineModels, fields, models } from "@web/../tests/web_test_helpers";

import { mountViewEditor } from "@web_studio/../tests/view_editor_tests_utils";

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

test("empty kanban editor", async () => {
    await mountViewEditor({
        type: "kanban",
        resModel: "coucou",
        arch: `<kanban>
        <templates>
            <t t-name="kanban-box">
            </t>
        </templates>
    </kanban>
    `,
    });
    expect(".o_kanban_renderer").toHaveCount(1);
});
