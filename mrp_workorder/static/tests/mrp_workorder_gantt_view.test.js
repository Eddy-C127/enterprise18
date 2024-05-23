import { describe, expect, test } from "@odoo/hoot";
import { queryAll } from "@odoo/hoot-dom";
import { mockDate } from "@odoo/hoot-mock";
import { defineModels, fields, models, onRpc } from "@web/../tests/web_test_helpers";
import { hoverGridCell, SELECTORS, mountGanttView } from "@web_gantt/../tests/web_gantt_test_helpers";

describe.current.tags("desktop");

class Workorder extends models.Model {
    name = fields.Char();
    planned_start = fields.Datetime();
    planned_stop = fields.Datetime();
    workcenter_id = fields.Many2one({ string: "Work Center", relation: "workcenter" });

    _records = [
        {
            id: 1,
            name: "Blop",
            planned_start: "2023-02-24 08:00:00",
            planned_stop: "2023-03-20 08:00:00",
            workcenter_id: 1,
        },
        {
            id: 2,
            name: "Yop",
            planned_start: "2023-02-22 08:00:00",
            planned_stop: "2023-03-27 08:00:00",
            workcenter_id: 2,
        },
    ]

    _views = {
        "form": `
            <form>
                <field name="name"/>
                <field name="start_datetime"/>
                <field name="date_deadline"/>
            </form>
        `,
    }
}

class Workcenter extends models.Model {
    name = fields.Char();

    _records = [
        { id: 1, name: "Assembly Line 1" },
        { id: 2, name: "Assembly Line 2" },
    ];
}

defineModels([Workorder, Workcenter]);

test("progress bar has the correct unit", async () => {
    expect.assertions(13);

    mockDate("2023-03-05 07:00:00");
    onRpc("gantt_progress_bar", ({ args, model }) => {
        expect(model).toBe("workorder");
        expect(args[0]).toEqual(["workcenter_id"]);
        expect(args[1]).toEqual({ workcenter_id: [1, 2] });
        return {
            workcenter_id: {
                1: { value: 465, max_value: 744 },
                2: { value: 651, max_value: 744 },
            },
        };
    })

    await mountGanttView({
        arch: `
            <gantt js_class="mrp_workorder_gantt"
                date_start="planned_start"
                date_stop="planned_stop"
                progress_bar="workcenter_id"
            />
        `,
        resModel: "workorder",
        groupBy: ["workcenter_id"],
    });
    expect(SELECTORS.progressBar).toHaveCount(2);
    expect(SELECTORS.progressBarBackground).toHaveCount(2);
    expect(
        [...queryAll(SELECTORS.progressBarBackground)].map((el) => el.style.width)
    ).toEqual(
        ["62.5%", "87.5%"]
    );

    expect(SELECTORS.progressBarForeground).toHaveCount(0);

    await hoverGridCell("01 March 2023", "Assembly Line 1");
    expect(SELECTORS.progressBarForeground).toHaveCount(1);
    expect(SELECTORS.progressBarForeground).toHaveText("465h / 744h");
    expect(`${SELECTORS.progressBar} > span > .o_gantt_group_hours_ratio`).toHaveText("(62.5%)");

    await hoverGridCell("01 March 2023", "Assembly Line 2");
    expect(SELECTORS.progressBarForeground).toHaveCount(1);
    expect(SELECTORS.progressBarForeground).toHaveText("651h / 744h");
    expect(`${SELECTORS.progressBar} > span > .o_gantt_group_hours_ratio`).toHaveText("(87.5%)");
});
