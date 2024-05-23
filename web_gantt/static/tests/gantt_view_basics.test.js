import { beforeEach, describe, expect, test } from "@odoo/hoot";
import { queryAll, queryAllTexts } from "@odoo/hoot-dom";
import { animationFrame, mockDate } from "@odoo/hoot-mock";
import {
    contains,
    fields,
    getService,
    mountWithCleanup,
    onRpc,
    patchWithCleanup,
} from "@web/../tests/web_test_helpers";
import { Tasks, defineGanttModels } from "./gantt_mock_models";
import {
    SELECTORS,
    getActiveScale,
    getGridContent,
    mountGanttView,
    selectGanttRange,
    setScale,
} from "./web_gantt_test_helpers";

import { browser } from "@web/core/browser/browser";
import { Domain } from "@web/core/domain";
import { deserializeDateTime } from "@web/core/l10n/dates";
import { WebClient } from "@web/webclient/webclient";

describe.current.tags("desktop");

defineGanttModels();
beforeEach(() => mockDate("2018-12-20T08:00:00", +1));

test("empty ungrouped gantt rendering", async () => {
    await mountGanttView({
        resModel: "tasks",
        arch: `<gantt date_start="start" date_stop="stop" />`,
        domain: [["id", "=", 0]],
    });
    const { viewTitle, range, columnHeaders, rows } = getGridContent();
    expect(viewTitle).toBe(null);
    expect(range).toBe("01 December 2018 - 28 February 2019");
    expect(columnHeaders).toHaveLength(34);
    expect(rows).toEqual([{}]);
    expect(SELECTORS.noContentHelper).toHaveCount(0);
});

test("ungrouped gantt rendering", async () => {
    const task2 = Tasks._records[1];
    const startDateLocalString = deserializeDateTime(task2.start).toFormat("f");
    const stopDateLocalString = deserializeDateTime(task2.stop).toFormat("f");
    Tasks._views.gantt = `<gantt date_start="start" date_stop="stop"/>`;
    Tasks._views.search = `<search/>`;

    onRpc("get_gantt_data", ({ model }) => expect.step(model));
    await mountWithCleanup(WebClient);
    await getService("action").doAction({
        res_model: "tasks",
        type: "ir.actions.act_window",
        views: [[false, "gantt"]],
    });
    expect(["tasks"]).toVerifySteps();
    await animationFrame();

    const { viewTitle, range, columnHeaders, rows } = getGridContent();
    expect(viewTitle).toBe(null);
    expect(range).toBe("01 December 2018 - 28 February 2019");
    expect(columnHeaders).toHaveLength(34);
    expect(getActiveScale()).toBe("3");
    expect(SELECTORS.expandCollapseButtons).not.toBeVisible();
    expect(rows).toEqual([
        {
            pills: [
                {
                    title: "Task 5",
                    level: 0,
                    colSpan: "Out of bounds (1)  -> 04 (1/2) December 2018",
                },
                { title: "Task 1", level: 1, colSpan: "Out of bounds (1)  -> 31 December 2018" },
                {
                    title: "Task 2",
                    level: 0,
                    colSpan: "17 (1/2) December 2018 -> 22 (1/2) December 2018",
                },
                {
                    title: "Task 4",
                    level: 2,
                    colSpan: "20 December 2018 -> 20 (1/2) December 2018",
                },
                {
                    title: "Task 7",
                    level: 2,
                    colSpan: "20 (1/2) December 2018 -> 20 December 2018",
                },
                { title: "Task 3", level: 0, colSpan: "27 December 2018 -> 03 (1/2) January 2019" },
            ],
        },
    ]);

    // test popover and local timezone
    expect(`.o_popover`).toHaveCount(0);
    const task2Pill = queryAll(SELECTORS.pill)[2];
    expect(task2Pill).toHaveText("Task 2");

    await contains(task2Pill).click();
    expect(`.o_popover`).toHaveCount(1);
    expect(queryAllTexts`.o_popover .popover-body span`).toEqual([
        "Task 2",
        startDateLocalString,
        stopDateLocalString,
    ]);

    await contains(`.o_popover .popover-header i.fa.fa-close`).click();
    expect(`.o_popover`).toHaveCount(0);
});

test("ordered gantt view", async () => {
    await mountGanttView({
        resModel: "tasks",
        arch: `<gantt date_start="start" date_stop="stop" progress="progress"/>`,
        groupBy: ["stage_id"],
    });
    const { viewTitle, range, columnHeaders, rows } = getGridContent();
    expect(viewTitle).toBe("Gantt View");
    expect(range).toBe("01 December 2018 - 28 February 2019");
    expect(columnHeaders).toHaveLength(34);
    expect(SELECTORS.noContentHelper).toHaveCount(0);
    expect(rows).toEqual([
        {
            title: "todo",
        },
        {
            title: "in_progress",
            pills: [
                { level: 0, colSpan: "Out of bounds (1)  -> 31 December 2018", title: "Task 1" },
                {
                    level: 1,
                    colSpan: "20 (1/2) December 2018 -> 20 December 2018",
                    title: "Task 7",
                },
            ],
        },
        {
            title: "done",
            pills: [
                {
                    level: 0,
                    colSpan: "17 (1/2) December 2018 -> 22 (1/2) December 2018",
                    title: "Task 2",
                },
            ],
        },
        {
            title: "cancel",
            pills: [
                {
                    level: 0,
                    colSpan: "20 December 2018 -> 20 (1/2) December 2018",
                    title: "Task 4",
                },
                { level: 0, colSpan: "27 December 2018 -> 03 (1/2) January 2019", title: "Task 3" },
            ],
        },
    ]);
});

test("empty single-level grouped gantt rendering", async () => {
    await mountGanttView({
        resModel: "tasks",
        arch: `<gantt date_start="start" date_stop="stop"/>`,
        groupBy: ["project_id"],
        domain: Domain.FALSE.toList(),
    });
    const { viewTitle, range, columnHeaders, rows } = getGridContent();
    expect(viewTitle).toBe("Gantt View");
    expect(range).toBe("01 December 2018 - 28 February 2019");
    expect(columnHeaders).toHaveLength(34);
    expect(rows).toEqual([{ title: "" }]);
    expect(SELECTORS.noContentHelper).toHaveCount(0);
});

test("single-level grouped gantt rendering", async () => {
    await mountGanttView({
        resModel: "tasks",
        arch: `<gantt string="Tasks" date_start="start" date_stop="stop"/>`,
        groupBy: ["project_id"],
    });
    expect(getActiveScale()).toBe("3");
    expect(SELECTORS.expandCollapseButtons).not.toBeVisible();

    const { range, viewTitle, columnHeaders, rows } = getGridContent();
    expect(range).toBe("01 December 2018 - 28 February 2019");
    expect(viewTitle).toBe("Tasks");
    expect(columnHeaders).toHaveLength(34);
    expect(rows).toEqual([
        {
            title: "Project 1",
            pills: [
                {
                    title: "Task 1",
                    colSpan: "Out of bounds (1)  -> 31 December 2018",
                    level: 0,
                },
                {
                    title: "Task 2",
                    colSpan: "17 (1/2) December 2018 -> 22 (1/2) December 2018",
                    level: 1,
                },
                {
                    title: "Task 4",
                    colSpan: "20 December 2018 -> 20 (1/2) December 2018",
                    level: 2,
                },
                {
                    title: "Task 3",
                    colSpan: "27 December 2018 -> 03 (1/2) January 2019",
                    level: 1,
                },
            ],
        },
        {
            title: "Project 2",
            pills: [
                {
                    title: "Task 7",
                    colSpan: "20 (1/2) December 2018 -> 20 December 2018",
                    level: 0,
                },
            ],
        },
    ]);
});

test("single-level grouped gantt rendering with group_expand", async () => {
    const groups = [
        { project_id: [20, "Unused Project 1"], __record_ids: [] },
        { project_id: [50, "Unused Project 2"], __record_ids: [] },
        { project_id: [2, "Project 2"], __record_ids: [5, 7] },
        { project_id: [30, "Unused Project 3"], __record_ids: [] },
        { project_id: [1, "Project 1"], __record_ids: [1, 2, 3, 4] },
    ];
    patchWithCleanup(Tasks.prototype, {
        web_read_group: () => ({ groups, length: groups.length }),
    });

    await mountGanttView({
        resModel: "tasks",
        arch: `<gantt string="Tasks" date_start="start" date_stop="stop"/>`,
        groupBy: ["project_id"],
    });
    expect(getActiveScale()).toBe("3");
    expect(SELECTORS.expandCollapseButtons).not.toBeVisible();

    const { range, viewTitle, columnHeaders, rows } = getGridContent();
    expect(range).toBe("01 December 2018 - 28 February 2019");
    expect(viewTitle).toBe("Tasks");
    expect(columnHeaders).toHaveLength(34);
    expect(rows).toEqual([
        { title: "Unused Project 1" },
        { title: "Unused Project 2" },
        {
            title: "Project 2",
            pills: [
                {
                    title: "Task 7",
                    colSpan: "20 (1/2) December 2018 -> 20 December 2018",
                    level: 0,
                },
            ],
        },
        { title: "Unused Project 3" },
        {
            title: "Project 1",
            pills: [
                {
                    title: "Task 1",
                    colSpan: "Out of bounds (1)  -> 31 December 2018",
                    level: 0,
                },
                {
                    title: "Task 2",
                    colSpan: "17 (1/2) December 2018 -> 22 (1/2) December 2018",
                    level: 1,
                },
                {
                    title: "Task 4",
                    colSpan: "20 December 2018 -> 20 (1/2) December 2018",
                    level: 2,
                },
                {
                    title: "Task 3",
                    colSpan: "27 December 2018 -> 03 (1/2) January 2019",
                    level: 1,
                },
            ],
        },
    ]);
});

test("multi-level grouped gantt rendering", async () => {
    await mountGanttView({
        resModel: "tasks",
        arch: `<gantt string="Tasks" date_start="start" date_stop="stop"/>`,
        groupBy: ["user_id", "project_id", "stage"],
    });
    expect(getActiveScale()).toBe("3");
    expect(SELECTORS.expandCollapseButtons).toHaveCount(2);

    const { range, viewTitle, columnHeaders, rows } = getGridContent();
    expect(range).toBe("01 December 2018 - 28 February 2019");
    expect(viewTitle).toBe("Tasks");
    expect(columnHeaders).toHaveLength(34);
    expect(rows).toEqual([
        {
            title: "User 1",
            isGroup: true,
            pills: [
                { title: "1", colSpan: "Out of bounds (8)  -> 19 December 2018" },
                { title: "2", colSpan: "20 December 2018 -> 20 (1/2) December 2018" },
                { title: "1", colSpan: "20 (1/2) December 2018 -> 31 December 2018" },
            ],
        },
        {
            title: "Project 1",
            isGroup: true,
            pills: [
                { title: "1", colSpan: "Out of bounds (1)  -> 19 December 2018" },
                { title: "2", colSpan: "20 December 2018 -> 20 (1/2) December 2018" },
                { title: "1", colSpan: "20 (1/2) December 2018 -> 31 December 2018" },
            ],
        },
        {
            title: "To Do",
            pills: [
                { title: "Task 1", colSpan: "Out of bounds (1)  -> 31 December 2018", level: 0 },
            ],
        },
        {
            title: "In Progress",
            pills: [
                {
                    title: "Task 4",
                    colSpan: "20 December 2018 -> 20 (1/2) December 2018",
                    level: 0,
                },
            ],
        },
        {
            title: "Project 2",
            isGroup: true,
        },
        {
            title: "Done",
        },
        {
            title: "User 2",
            isGroup: true,
            pills: [
                { title: "1", colSpan: "17 (1/2) December 2018 -> 20 (1/2) December 2018" },
                { title: "2", colSpan: "20 (1/2) December 2018 -> 20 December 2018" },
                { title: "1", colSpan: "21 December 2018 -> 22 (1/2) December 2018" },
                { title: "1", colSpan: "27 December 2018 -> 03 (1/2) January 2019" },
            ],
        },
        {
            title: "Project 1",
            isGroup: true,
            pills: [
                { title: "1", colSpan: "17 (1/2) December 2018 -> 22 (1/2) December 2018" },
                { title: "1", colSpan: "27 December 2018 -> 03 (1/2) January 2019" },
            ],
        },
        {
            title: "Done",
            pills: [
                {
                    title: "Task 2",
                    colSpan: "17 (1/2) December 2018 -> 22 (1/2) December 2018",
                    level: 0,
                },
            ],
        },
        {
            title: "Cancelled",
            pills: [
                { title: "Task 3", colSpan: "27 December 2018 -> 03 (1/2) January 2019", level: 0 },
            ],
        },
        {
            title: "Project 2",
            isGroup: true,
            pills: [{ title: "1", colSpan: "20 (1/2) December 2018 -> 20 December 2018" }],
        },
        {
            title: "Cancelled",
            pills: [
                {
                    title: "Task 7",
                    colSpan: "20 (1/2) December 2018 -> 20 December 2018",
                    level: 0,
                },
            ],
        },
    ]);
    expect(`.o_gantt_group_pill .o_gantt_consolidated_pill`).toHaveStyle({
        backgroundColor: "rgb(113, 75, 103)",
    });
});

test("many2many grouped gantt rendering", async () => {
    Tasks._fields.user_ids = fields.Many2many({ string: "Assignees", relation: "res.users" });
    Tasks._records[0].user_ids = [1, 2];

    await mountGanttView({
        resModel: "tasks",
        arch: `<gantt string="Tasks" date_start="start" date_stop="stop"/>`,
        groupBy: ["user_ids"],
    });
    expect(getActiveScale()).toBe("3");
    expect(SELECTORS.expandCollapseButtons).not.toBeVisible();

    const { range, viewTitle, columnHeaders, rows } = getGridContent();
    expect(range).toBe("01 December 2018 - 28 February 2019");
    expect(viewTitle).toBe("Tasks");
    expect(columnHeaders).toHaveLength(34);
    expect(rows).toEqual([
        {
            title: "Undefined Assignees",
            pills: [
                {
                    title: "Task 2",
                    colSpan: "17 (1/2) December 2018 -> 22 (1/2) December 2018",
                    level: 0,
                },
                {
                    title: "Task 4",
                    colSpan: "20 December 2018 -> 20 (1/2) December 2018",
                    level: 1,
                },
                {
                    title: "Task 7",
                    colSpan: "20 (1/2) December 2018 -> 20 December 2018",
                    level: 1,
                },
                { title: "Task 3", colSpan: "27 December 2018 -> 03 (1/2) January 2019", level: 0 },
            ],
        },
        {
            title: "User 1",
            pills: [
                { title: "Task 1", colSpan: "Out of bounds (1)  -> 31 December 2018", level: 0 },
            ],
        },
        {
            title: "User 2",
            pills: [
                { title: "Task 1", colSpan: "Out of bounds (1)  -> 31 December 2018", level: 0 },
            ],
        },
    ]);
});

test("multi-level grouped with many2many field in gantt view", async () => {
    Tasks._fields.user_ids = fields.Many2many({ string: "Assignees", relation: "res.users" });
    Tasks._records[0].user_ids = [1, 2];

    await mountGanttView({
        resModel: "tasks",
        arch: `<gantt string="Tasks" date_start="start" date_stop="stop"/>`,
        groupBy: ["user_ids", "project_id"],
    });
    expect(getActiveScale()).toBe("3");
    expect(SELECTORS.expandCollapseButtons).toHaveCount(2);

    const { range, viewTitle, columnHeaders, rows } = getGridContent();
    expect(range).toBe("01 December 2018 - 28 February 2019");
    expect(viewTitle).toBe("Tasks");
    expect(columnHeaders).toHaveLength(34);
    expect(rows).toEqual([
        {
            title: "Undefined Assignees",
            isGroup: true,
            pills: [
                { title: "1", colSpan: "17 (1/2) December 2018 -> 19 December 2018" },
                { title: "2", colSpan: "20 December 2018 -> 20 (1/2) December 2018" },
                { title: "2", colSpan: "20 (1/2) December 2018 -> 20 December 2018" },
                { title: "1", colSpan: "21 December 2018 -> 22 (1/2) December 2018" },
                { title: "1", colSpan: "27 December 2018 -> 03 (1/2) January 2019" },
            ],
        },
        {
            title: "Project 1",
            pills: [
                {
                    title: "Task 2",
                    colSpan: "17 (1/2) December 2018 -> 22 (1/2) December 2018",
                    level: 0,
                },
                {
                    title: "Task 4",
                    colSpan: "20 December 2018 -> 20 (1/2) December 2018",
                    level: 1,
                },
                { title: "Task 3", colSpan: "27 December 2018 -> 03 (1/2) January 2019", level: 0 },
            ],
        },
        {
            title: "Project 2",
            pills: [
                {
                    title: "Task 7",
                    colSpan: "20 (1/2) December 2018 -> 20 December 2018",
                    level: 0,
                },
            ],
        },
        {
            title: "User 1",
            isGroup: true,
            pills: [{ title: "1", colSpan: "Out of bounds (1)  -> 31 December 2018" }],
        },
        {
            title: "Project 1",
            pills: [
                { title: "Task 1", colSpan: "Out of bounds (1)  -> 31 December 2018", level: 0 },
            ],
        },
        {
            title: "User 2",
            isGroup: true,
            pills: [{ title: "1", colSpan: "Out of bounds (1)  -> 31 December 2018" }],
        },
        {
            title: "Project 1",
            pills: [
                { title: "Task 1", colSpan: "Out of bounds (1)  -> 31 December 2018", level: 0 },
            ],
        },
    ]);
});

test("full precision gantt rendering", async () => {
    await mountGanttView({
        resModel: "tasks",
        arch: `<gantt date_start="start" default_scale="week" date_stop="stop" precision="{'day':'hour:full', 'week':'day:full', 'month':'day:full'}"/>`,
        groupBy: ["user_id", "project_id"],
    });
    expect(getActiveScale()).toBe("1");
    expect(SELECTORS.expandCollapseButtons).toHaveCount(2);

    const { range, viewTitle, columnHeaders, rows } = getGridContent();
    expect(range).toBe("16 December 2018 - 05 January 2019");
    expect(viewTitle).toBe("Gantt View");
    expect(columnHeaders).toHaveLength(9);
    expect(rows).toEqual([
        {
            title: "User 1",
            isGroup: true,
            pills: [
                { title: "1", colSpan: "16 W51 2018 -> 19 W51 2018" },
                { title: "2", colSpan: "20 W51 2018 -> 20 W51 2018" },
                { title: "1", colSpan: "21 W51 2018 -> Out of bounds (17) " },
            ],
        },
        {
            title: "Project 1",
            pills: [
                { level: 0, colSpan: "16 W51 2018 -> Out of bounds (17) ", title: "Task 1" },
                { level: 1, colSpan: "20 W51 2018 -> 20 W51 2018", title: "Task 4" },
            ],
        },
        {
            title: "User 2",
            isGroup: true,
            pills: [
                { title: "1", colSpan: "17 W51 2018 -> 19 W51 2018" },
                { title: "2", colSpan: "20 W51 2018 -> 20 W51 2018" },
                { title: "1", colSpan: "21 W51 2018 -> 22 W51 2018" },
            ],
        },
        {
            title: "Project 1",
            pills: [{ level: 0, colSpan: "17 W51 2018 -> 22 W51 2018", title: "Task 2" }],
        },
        {
            title: "Project 2",
            pills: [{ level: 0, colSpan: "20 W51 2018 -> 20 W51 2018", title: "Task 7" }],
        },
    ]);
});

test("gantt rendering, thumbnails", async () => {
    onRpc("get_gantt_data", () => ({
        groups: [
            {
                user_id: [1, "User 1"],
                __record_ids: [1],
            },
            {
                user_id: false,
                __record_ids: [2],
            },
        ],
        length: 2,
        records: [
            {
                display_name: "Task 1",
                id: 1,
                start: "2018-11-30 18:30:00",
                stop: "2018-12-31 18:29:59",
            },
            {
                display_name: "Task 2",
                id: 2,
                start: "2018-12-01 18:30:00",
                stop: "2018-12-02 18:29:59",
            },
        ],
    }));
    await mountGanttView({
        resModel: "tasks",
        arch: `<gantt date_start="start" date_stop="stop" thumbnails="{'user_id': 'image'}"/>`,
        groupBy: ["user_id"],
    });
    expect(SELECTORS.thumbnail).toHaveCount(1);
    expect(SELECTORS.thumbnail).toHaveAttribute(
        "data-src",
        /web\/image\?model=res\.users&id=1&field=image/
    );
});

test("gantt rendering, pills must be chronologically ordered", async () => {
    onRpc("get_gantt_data", () => ({
        groups: [
            {
                user_id: [1, "User 1"],
                __record_ids: [1],
            },
            {
                user_id: false,
                __record_ids: [2],
            },
        ],
        length: 2,
        records: [
            {
                display_name: "Task 14:30:00",
                id: 1,
                start: "2018-12-17 14:30:00",
                stop: "2018-12-17 18:29:59",
            },
            {
                display_name: "Task 08:30:00",
                id: 2,
                start: "2018-12-17 08:30:00",
                stop: "2018-12-17 13:29:59",
            },
        ],
    }));
    await mountGanttView({
        resModel: "tasks",
        arch: `<gantt string="Tasks" default_scale="week" date_start="start" date_stop="stop" thumbnails="{'user_id': 'image'}"/>`,
    });
    const { rows } = getGridContent();
    expect(rows).toEqual([
        {
            pills: [
                { title: "Task 08:30:00", level: 0, colSpan: "17 W51 2018 -> 17 W51 2018" },
                { title: "Task 14:30:00", level: 1, colSpan: "17 (1/2) W51 2018 -> 17 W51 2018" },
            ],
        },
    ]);
});

test("scale switching", async () => {
    await mountGanttView({
        resModel: "tasks",
        arch: `<gantt date_start="start" date_stop="stop"/>`,
    });

    // default (month)
    expect(getActiveScale()).toBe("3");
    expect(SELECTORS.expandCollapseButtons).not.toBeVisible();
    let gridContent = getGridContent();
    expect(gridContent.range).toBe("01 December 2018 - 28 February 2019");
    expect(gridContent.columnHeaders).toHaveLength(34);
    expect(gridContent.rows).toEqual([
        {
            pills: [
                {
                    title: "Task 5",
                    level: 0,
                    colSpan: "Out of bounds (1)  -> 04 (1/2) December 2018",
                },
                { title: "Task 1", level: 1, colSpan: "Out of bounds (1)  -> 31 December 2018" },
                {
                    title: "Task 2",
                    level: 0,
                    colSpan: "17 (1/2) December 2018 -> 22 (1/2) December 2018",
                },
                {
                    title: "Task 4",
                    level: 2,
                    colSpan: "20 December 2018 -> 20 (1/2) December 2018",
                },
                {
                    title: "Task 7",
                    level: 2,
                    colSpan: "20 (1/2) December 2018 -> 20 December 2018",
                },
                { title: "Task 3", level: 0, colSpan: "27 December 2018 -> 03 (1/2) January 2019" },
            ],
        },
    ]);

    // switch to day view
    await setScale(0);
    await contains(".o_gantt_button_today").click();
    expect(getActiveScale()).toBe("0");
    expect(SELECTORS.expandCollapseButtons).not.toBeVisible();
    gridContent = getGridContent();
    expect(gridContent.range).toBe("01 December 2018 - 28 February 2019");
    expect(gridContent.columnHeaders).toHaveLength(42);
    expect(gridContent.rows).toEqual([
        {
            pills: [
                {
                    title: "Task 1",
                    level: 1,
                    colSpan: "Out of bounds (1)  -> Out of bounds (741) ",
                },
                {
                    title: "Task 2",
                    level: 0,
                    colSpan: "Out of bounds (397)  -> Out of bounds (513) ",
                },
                {
                    title: "Task 4",
                    level: 2,
                    colSpan: "3am 20 December 2018 -> 7am 20 December 2018",
                },
                {
                    title: "Task 7",
                    level: 2,
                    colSpan: "1pm 20 December 2018 -> 7pm 20 December 2018",
                },
            ],
        },
    ]);

    // switch to week view
    await setScale(1);
    await contains(".o_gantt_button_today").click();

    expect(getActiveScale()).toBe("1");
    expect(SELECTORS.expandCollapseButtons).not.toBeVisible();
    gridContent = getGridContent();
    expect(gridContent.range).toBe("01 December 2018 - 28 February 2019");
    expect(gridContent.columnHeaders).toHaveLength(10);
    expect(gridContent.rows).toEqual([
        {
            pills: [
                { title: "Task 1", level: 1, colSpan: "Out of bounds (1)  -> Out of bounds (63) " },
                {
                    title: "Task 2",
                    level: 0,
                    colSpan: "17 (1/2) W51 2018 -> 22 (1/2) W51 2018",
                },
                { title: "Task 4", level: 2, colSpan: "20 W51 2018 -> 20 (1/2) W51 2018" },
                { title: "Task 7", level: 2, colSpan: "20 (1/2) W51 2018 -> 20 W51 2018" },
            ],
        },
    ]);

    // switch to month view
    await setScale(3);
    await contains(".o_gantt_button_today").click();

    expect(getActiveScale()).toBe("3");
    expect(SELECTORS.expandCollapseButtons).not.toBeVisible();
    gridContent = getGridContent();
    expect(gridContent.range).toBe("01 December 2018 - 28 February 2019");
    expect(gridContent.columnHeaders).toHaveLength(34);
    expect(gridContent.rows).toEqual([
        {
            pills: [
                {
                    title: "Task 5",
                    level: 0,
                    colSpan: "Out of bounds (1)  -> 04 (1/2) December 2018",
                },
                { title: "Task 1", level: 1, colSpan: "Out of bounds (1)  -> 31 December 2018" },
                {
                    title: "Task 2",
                    level: 0,
                    colSpan: "17 (1/2) December 2018 -> 22 (1/2) December 2018",
                },
                {
                    title: "Task 4",
                    level: 2,
                    colSpan: "20 December 2018 -> 20 (1/2) December 2018",
                },
                {
                    title: "Task 7",
                    level: 2,
                    colSpan: "20 (1/2) December 2018 -> 20 December 2018",
                },
                { title: "Task 3", level: 0, colSpan: "27 December 2018 -> 03 (1/2) January 2019" },
            ],
        },
    ]);

    // switch to year view
    await setScale(5);
    await contains(".o_gantt_button_today").click();

    expect(getActiveScale()).toBe("5");
    expect(SELECTORS.expandCollapseButtons).not.toBeVisible();
    gridContent = getGridContent();
    expect(gridContent.range).toBe("01 December 2018 - 28 February 2019");
    expect(gridContent.columnHeaders).toHaveLength(3);
    expect(gridContent.rows).toEqual([
        {
            pills: [
                { title: "Task 5", level: 0, colSpan: "December 2018 -> December 2018" },
                { title: "Task 1", level: 1, colSpan: "December 2018 -> December 2018" },
                { title: "Task 2", level: 2, colSpan: "December 2018 -> December 2018" },
                { title: "Task 4", level: 3, colSpan: "December 2018 -> December 2018" },
                { title: "Task 7", level: 4, colSpan: "December 2018 -> December 2018" },
                { title: "Task 3", level: 5, colSpan: "December 2018 -> January 2019" },
            ],
        },
    ]);
});

test("today is highlighted", async () => {
    await mountGanttView({
        resModel: "tasks",
        arch: `<gantt date_start="start" date_stop="stop"/>`,
    });
    expect(`.o_gantt_header_cell.o_gantt_today`).toHaveCount(1);
    expect(`.o_gantt_header_cell.o_gantt_today`).toHaveText("20");
});

test("current month is highlighted'", async () => {
    await mountGanttView({
        resModel: "tasks",
        arch: '<gantt date_start="start" date_stop="stop" default_scale="year"/>',
    });
    expect(`.o_gantt_header_cell.o_gantt_today`).toHaveCount(1);
    expect(`.o_gantt_header_cell.o_gantt_today`).toHaveText("December");
});

test("current hour is highlighted'", async () => {
    await mountGanttView({
        resModel: "tasks",
        arch: '<gantt date_start="start" date_stop="stop" default_scale="day"/>',
    });
    expect(`.o_gantt_header_cell.o_gantt_today`).toHaveCount(1);
    expect(`.o_gantt_header_cell.o_gantt_today`).toHaveText("9am");
});

test("group tasks by task_properties", async () => {
    Tasks._fields.task_properties = fields.Properties({ string: "Task properties" });
    Tasks._records = [
        {
            id: 1,
            name: "Blop",
            start: "2018-12-14 08:00:00",
            stop: "2018-12-24 08:00:00",
            user_id: 1,
            project_id: 1,
            task_properties: {
                name: "bd6404492c244cff",
                type: "char",
                value: "test value 1",
            },
        },
        {
            id: 2,
            name: "Yop",
            start: "2018-12-02 08:00:00",
            stop: "2018-12-12 08:00:00",
            user_id: 2,
            project_id: 1,
            task_properties: {
                name: "bd6404492c244cff",
                type: "char",
                value: "test value 1",
            },
        },
    ];
    await mountGanttView({
        resModel: "tasks",
        arch: '<gantt date_start="start" date_stop="stop"/>',
        groupBy: ["task_properties.bd6404492c244cff"],
    });
    const { rows } = getGridContent();
    expect(rows).toEqual([
        {
            pills: [
                {
                    title: "Yop",
                    colSpan: "Out of bounds (3)  -> 12 (1/2) December 2018",
                    level: 0,
                },
                {
                    title: "Blop",
                    colSpan: "14 December 2018 -> 24 (1/2) December 2018",
                    level: 0,
                },
            ],
        },
    ]);
});

test("group tasks by date", async () => {
    Tasks._fields.my_date = fields.Date({ string: "My date" });
    Tasks._records = [
        {
            id: 1,
            name: "Blop",
            start: "2018-12-14 08:00:00",
            stop: "2018-12-24 08:00:00",
            user_id: 1,
            project_id: 1,
        },
        {
            id: 2,
            name: "Yop",
            start: "2018-12-02 08:00:00",
            stop: "2018-12-12 08:00:00",
            user_id: 2,
            project_id: 1,
        },
    ];
    await mountGanttView({
        resModel: "tasks",
        arch: '<gantt date_start="start" date_stop="stop"/>',
        groupBy: ["my_date:month"],
    });
    const { rows } = getGridContent();
    expect(rows).toEqual([
        {
            pills: [
                {
                    title: "Yop",
                    colSpan: "Out of bounds (3)  -> 12 (1/2) December 2018",
                    level: 0,
                },
                {
                    title: "Blop",
                    colSpan: "14 December 2018 -> 24 (1/2) December 2018",
                    level: 0,
                },
            ],
        },
    ]);
});

test("Scale: scale default is fetched from localStorage", async () => {
    let view;
    patchWithCleanup(browser.localStorage, {
        getItem(key) {
            if (String(key).startsWith("scaleOf-viewId")) {
                expect.step(`get_scale_week`);
                return "week";
            }
        },
        setItem(key, value) {
            if (view && key === `scaleOf-viewId-${view.env?.config?.viewId}`) {
                expect.step(`set_scale_${value}`);
            }
        },
    });
    view = await mountGanttView({
        type: "gantt",
        resModel: "tasks",
        arch: '<gantt date_start="start" date_stop="stop" default_scale="week"/>',
    });
    expect(getActiveScale()).toBe("1");
    await setScale(5);
    expect(getActiveScale()).toBe("5");
    expect(["get_scale_week", "set_scale_year"]).toVerifySteps();
});

test("initialization with default_start_date only", async (assert) => {
    await mountGanttView({
        type: "gantt",
        resModel: "tasks",
        arch: '<gantt date_start="start" date_stop="stop" />',
        context: { default_start_date: "2028-04-25" },
    });
    const { range, columnHeaders, groupHeaders } = getGridContent();
    expect(range).toBe("25 April 2028 - 30 June 2028");
    expect(columnHeaders.slice(0, 7).map((h) => h.title)).toEqual([
        "25",
        "26",
        "27",
        "28",
        "29",
        "30",
        "01",
    ]);
    expect(groupHeaders.map((h) => h.title)).toEqual(["April 2028", "May 2028"]);
});

test("initialization with default_stop_date only", async (assert) => {
    await mountGanttView({
        type: "gantt",
        resModel: "tasks",
        arch: '<gantt date_start="start" date_stop="stop" />',
        context: { default_stop_date: "2028-04-25" },
    });
    const { range, columnHeaders, groupHeaders } = getGridContent();
    expect(range).toBe("01 February 2028 - 25 April 2028");
    expect(
        columnHeaders.slice(columnHeaders.length - 7, columnHeaders.length).map((h) => h.title)
    ).toEqual(["19", "20", "21", "22", "23", "24", "25"]);
    expect(groupHeaders.map((h) => h.title)).toEqual(["March 2028", "April 2028"]);
});

test("initialization with default_start_date and default_stop_date", async (assert) => {
    await mountGanttView({
        type: "gantt",
        resModel: "tasks",
        arch: '<gantt date_start="start" date_stop="stop" />',
        context: {
            default_start_date: "2017-01-29",
            default_stop_date: "2019-05-26",
        },
    });
    const { range, groupHeaders } = getGridContent();
    expect(range).toBe("29 January 2017 - 26 May 2019");
    expect(groupHeaders.map((h) => h.title)).toEqual(["December 2018", "January 2019"]);
    expect(`${SELECTORS.columnHeader}.o_gantt_today`).toHaveCount(1);
});

test("data fetched with right domain", async () => {
    onRpc("get_gantt_data", ({ kwargs }) => {
        expect.step(JSON.stringify(kwargs.domain));
    });
    await mountGanttView({
        resModel: "tasks",
        arch: `
            <gantt date_start="start" date_stop="stop" default_scale="day"/>
        `,
    });
    expect([
        `["&",["start","<","2018-12-22 23:00:00"],["stop",">","2018-12-19 23:00:00"]]`,
    ]).toVerifySteps();
    await setScale("5");
    expect([
        `["&",["start","<","2018-12-31 23:00:00"],["stop",">","2018-11-30 23:00:00"]]`,
    ]).toVerifySteps();
    await selectGanttRange({ startDate: "2018-12-31", stopDate: "2019-06-15" });
    expect([
        `["&",["start","<","2018-12-31 23:00:00"],["stop",">","2018-11-30 23:00:00"]]`,
        `["&",["start","<","2019-06-30 23:00:00"],["stop",">","2018-11-30 23:00:00"]]`,
    ]).toVerifySteps();
});

test("switch startDate and stopDate if not in <= relation", async () => {
    await mountGanttView({
        resModel: "tasks",
        arch: `
            <gantt date_start="start" date_stop="stop"/>
        `,
    });
    expect(getGridContent().range).toBe("01 December 2018 - 28 February 2019");
    await selectGanttRange({ startDate: "2019-03-01", stopDate: "2019-02-28" });
    expect(getGridContent().range).toBe("28 February 2019 - 01 March 2019");
    await selectGanttRange({ startDate: "2019-02-28", stopDate: "2006-01-06" });
    expect(getGridContent().range).toBe("06 January 2006 - 05 January 2016"); // + exchange + span 10 years max
});
