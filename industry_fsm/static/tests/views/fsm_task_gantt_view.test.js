import { defineMailModels } from "@mail/../tests/mail_test_helpers";
import { describe, expect, test } from "@odoo/hoot";
import { click } from "@odoo/hoot-dom";
import { animationFrame, mockDate } from "@odoo/hoot-mock";
import { defineModels, fields, models, onRpc } from "@web/../tests/web_test_helpers";
import { mountGanttView } from "@web_gantt/../tests/web_gantt_test_helpers";

describe.current.tags("desktop");

class Task extends models.Model {
    name = fields.Char();
    start_datetime = fields.Datetime({ string: "Start Date" });
    date_deadline = fields.Datetime({ string: "Stop Date" });
    project_id = fields.Many2one({ relation: "project" });

    _views = {
        form: `
            <form>
                <field name="name"/>
                <field name="start_datetime"/>
                <field name="date_deadline"/>
            </form>
        `,
    };
}

class Project extends models.Model {
    name = fields.Char();

    _records = [{ id: 1, name: "My Project" }];
}

defineModels([Task, Project]);
defineMailModels();

test("fsm task gantt view", async () => {
    mockDate("2024-01-03 07:00:00");
    onRpc("get_all_deadlines", () => ({ milestone_id: [], project_id: [] }));
    const now = luxon.DateTime.now();
    await mountGanttView({
        arch: '<gantt date_start="start_datetime" date_stop="date_deadline" js_class="task_gantt" />',
        resModel: "task",
        context: { fsm_mode: true },
    });
    expect(".o_gantt_view").toHaveCount(1);
    expect(".modal").toHaveCount(0);
    click(".o_gantt_button_add.btn-primary");
    await animationFrame();
    expect(".modal").toHaveCount(1);
    expect(".modal .o_field_widget[name=start_datetime] .o_input").toHaveValue(
        now.toFormat("MM/dd/yyyy 00:00:00"),
        {
            message:
                "The fsm_mode present in the view context should set the start_datetime to the current day instead of the first day of the gantt view",
        }
    );
});
