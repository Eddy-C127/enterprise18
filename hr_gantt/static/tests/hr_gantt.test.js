import { defineMailModels } from "@mail/../tests/mail_test_helpers";
import { beforeEach, describe, expect, test } from "@odoo/hoot";
import { mockDate } from "@odoo/hoot-mock";
import { defineModels, fields, models } from "@web/../tests/web_test_helpers";
import { mountGanttView } from "@web_gantt/../tests/web_gantt_test_helpers";

describe.current.tags("desktop");

class Employee extends models.Model {
    _name = "hr.employee.public";

    _records = [
        { id: 1, display_name: "Mario" },
        { id: 2, display_name: "Luigi" },
        { id: 3, display_name: "Yoshi" },
    ];
}

class Task extends models.Model {
    start = fields.Datetime();
    stop = fields.Datetime();
    employee_id = fields.Many2one({ relation: "hr.employee.public" });
    foo = fields.Char();

    _records = [
        {
            id: 1,
            display_name: "Task 1",
            start: "2018-11-30 18:30:00",
            stop: "2018-12-31 18:29:59",
            employee_id: 1,
            foo: "Foo 1",
        },
        {
            id: 2,
            display_name: "Task 2",
            start: "2018-12-17 11:30:00",
            stop: "2018-12-22 06:29:59",
            employee_id: 2,
            foo: "Foo 2",
        },
        {
            id: 3,
            display_name: "Task 3",
            start: "2018-12-27 06:30:00",
            stop: "2019-01-03 06:29:59",
            employee_id: 3,
            foo: "Foo 1",
        },
        {
            id: 4,
            display_name: "Task 4",
            start: "2018-12-19 18:30:00",
            stop: "2018-12-20 06:29:59",
            employee_id: 1,
            foo: "Foo 3",
        },
    ];
}

defineMailModels();
defineModels([Employee, Task]);

const arch = `<gantt js_class="hr_gantt" date_start="start" date_stop="stop" />`;

beforeEach(() => {
    mockDate("2018-12-20 07:00:00", +1);
});

test("hr gantt view not grouped", async () => {
    await mountGanttView({ resModel: "task", arch });
    expect(".o-mail-Avatar").toHaveCount(0);
});

test("hr gantt view grouped by employee only", async () => {
    await mountGanttView({ resModel: "task", arch, groupBy: ["employee_id"] });
    expect(".o_gantt_row_title .o-mail-Avatar").toHaveCount(3);
});

test("hr gantt view grouped by employee > foo", async () => {
    await mountGanttView({ resModel: "task", arch, groupBy: ["employee_id", "foo"] });
    expect(".o_gantt_row_header.o_gantt_group .o_gantt_row_title .o-mail-Avatar").toHaveCount(3);
});

test("hr gantt view grouped by foo > employee", async () => {
    await mountGanttView({ resModel: "task", arch, groupBy: ["foo", "employee_id"] });
    expect(".o_gantt_row_header:not(.o_gantt_group) .o_gantt_row_title .o-mail-Avatar").toHaveCount(
        4
    );
});
