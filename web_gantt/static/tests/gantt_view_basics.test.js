import { beforeEach, expect, test } from "@odoo/hoot";
import { queryAll, queryAllTexts } from "@odoo/hoot-dom";
import {
    contains,
    fields,
    getService,
    mountView,
    mountWithCleanup,
    onRpc,
    patchDate,
    patchWithCleanup,
} from "@web/../tests/web_test_helpers";
import { Tasks, defineGanttModels } from "./gantt_mock_models";
import { SELECTORS, getActiveScale, getGridContent, setScale } from "./gantt_test_helpers";

import { Domain } from "@web/core/domain";
import { deserializeDateTime } from "@web/core/l10n/dates";
import { WebClient } from "@web/webclient/webclient";

defineGanttModels();

beforeEach(() => {
    patchDate("2018-12-20T08:00:00", +1);
});

test("empty ungrouped gantt rendering", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" />`,
        domain: [["id", "=", 0]],
    });
    const { viewTitle, range, columnHeaders, rows } = getGridContent();
    expect(viewTitle).toBe(null);
    expect(range).toBe("December 2018");
    expect(columnHeaders).toHaveLength(31);
    expect(rows).toEqual([{}]);
    expect(SELECTORS.noContentHelper).toHaveCount(0);
});

test("ungrouped gantt rendering", async () => {
    const task2 = Tasks._records[1];
    const startDateLocalString = deserializeDateTime(task2.start).toFormat("f");
    const stopDateLocalString = deserializeDateTime(task2.stop).toFormat("f");
    Tasks._views.gantt = `<gantt date_start="start" date_stop="stop"/>`;
    Tasks._views.search = `<search/>`;

    onRpc("get_gantt_data", (_, { model }) => expect.step(model));
    await mountWithCleanup(WebClient);
    await getService("action").doAction({
        res_model: "tasks",
        type: "ir.actions.act_window",
        views: [[false, "gantt"]],
    });
    expect(["tasks"]).toVerifySteps();

    const { viewTitle, range, columnHeaders, rows } = getGridContent();
    expect(viewTitle).toBe(null);
    expect(range).toBe("December 2018");
    expect(columnHeaders).toHaveLength(31);
    expect(getActiveScale()).toBe("Month");
    expect(SELECTORS.expandCollapseButtons).toHaveCount(0);
    expect(rows).toEqual([
        {
            pills: [
                { title: "Task 5", level: 0, colSpan: "01 -> 04 (1/2)" },
                { title: "Task 1", level: 1, colSpan: "01 -> 31" },
                { title: "Task 2", level: 0, colSpan: "17 (1/2) -> 22 (1/2)" },
                { title: "Task 4", level: 2, colSpan: "20 -> 20 (1/2)" },
                { title: "Task 7", level: 2, colSpan: "20 (1/2) -> 20" },
                { title: "Task 3", level: 0, colSpan: "27 -> 31" },
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
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" progress="progress"/>`,
        groupBy: ["stage_id"],
    });
    const { viewTitle, range, columnHeaders, rows } = getGridContent();
    expect(viewTitle).toBe("Gantt View");
    expect(range).toBe("December 2018");
    expect(columnHeaders).toHaveLength(31);
    expect(SELECTORS.noContentHelper).toHaveCount(0);
    expect(rows).toEqual([
        {
            title: "todo",
            pills: [{ level: 0, colSpan: "01 -> 04 (1/2)", title: "Task 5" }],
        },
        {
            title: "in_progress",
            pills: [
                { level: 0, colSpan: "01 -> 31", title: "Task 1" },
                { level: 1, colSpan: "20 (1/2) -> 20", title: "Task 7" },
            ],
        },
        {
            title: "done",
            pills: [{ level: 0, colSpan: "17 (1/2) -> 22 (1/2)", title: "Task 2" }],
        },
        {
            title: "cancel",
            pills: [
                { level: 0, colSpan: "20 -> 20 (1/2)", title: "Task 4" },
                { level: 0, colSpan: "27 -> 31", title: "Task 3" },
            ],
        },
    ]);
});

test("empty single-level grouped gantt rendering", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop"/>`,
        groupBy: ["project_id"],
        domain: Domain.FALSE.toList(),
    });
    const { viewTitle, range, columnHeaders, rows } = getGridContent();
    expect(viewTitle).toBe("Gantt View");
    expect(range).toBe("December 2018");
    expect(columnHeaders).toHaveLength(31);
    expect(rows).toEqual([{ title: "" }]);
    expect(SELECTORS.noContentHelper).toHaveCount(0);
});

test("single-level grouped gantt rendering", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt string="Tasks" date_start="start" date_stop="stop"/>`,
        groupBy: ["project_id"],
    });
    expect(getActiveScale()).toBe("Month");
    expect(SELECTORS.expandCollapseButtons).toHaveCount(0);

    const { range, viewTitle, columnHeaders, rows } = getGridContent();
    expect(range).toBe("December 2018");
    expect(viewTitle).toBe("Tasks");
    expect(columnHeaders).toHaveLength(31);
    expect(rows).toEqual([
        {
            title: "Project 1",
            pills: [
                {
                    title: "Task 1",
                    colSpan: "01 -> 31",
                    level: 0,
                },
                {
                    title: "Task 2",
                    colSpan: "17 (1/2) -> 22 (1/2)",
                    level: 1,
                },
                {
                    title: "Task 4",
                    colSpan: "20 -> 20 (1/2)",
                    level: 2,
                },
                {
                    title: "Task 3",
                    colSpan: "27 -> 31",
                    level: 1,
                },
            ],
        },
        {
            title: "Project 2",
            pills: [
                {
                    title: "Task 5",
                    colSpan: "01 -> 04 (1/2)",
                    level: 0,
                },
                {
                    title: "Task 7",
                    colSpan: "20 (1/2) -> 20",
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

    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt string="Tasks" date_start="start" date_stop="stop"/>`,
        groupBy: ["project_id"],
    });
    expect(getActiveScale()).toBe("Month");
    expect(SELECTORS.expandCollapseButtons).toHaveCount(0);

    const { range, viewTitle, columnHeaders, rows } = getGridContent();
    expect(range).toBe("December 2018");
    expect(viewTitle).toBe("Tasks");
    expect(columnHeaders).toHaveLength(31);
    expect(rows).toEqual([
        { title: "Unused Project 1" },
        { title: "Unused Project 2" },
        {
            title: "Project 2",
            pills: [
                {
                    title: "Task 5",
                    colSpan: "01 -> 04 (1/2)",
                    level: 0,
                },
                {
                    title: "Task 7",
                    colSpan: "20 (1/2) -> 20",
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
                    colSpan: "01 -> 31",
                    level: 0,
                },
                {
                    title: "Task 2",
                    colSpan: "17 (1/2) -> 22 (1/2)",
                    level: 1,
                },
                {
                    title: "Task 4",
                    colSpan: "20 -> 20 (1/2)",
                    level: 2,
                },
                {
                    title: "Task 3",
                    colSpan: "27 -> 31",
                    level: 1,
                },
            ],
        },
    ]);
});

test("multi-level grouped gantt rendering", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt string="Tasks" date_start="start" date_stop="stop"/>`,
        groupBy: ["user_id", "project_id", "stage"],
    });
    expect(getActiveScale()).toBe("Month");
    expect(SELECTORS.expandCollapseButtons).toHaveCount(2);

    const { range, viewTitle, columnHeaders, rows } = getGridContent();
    expect(range).toBe("December 2018");
    expect(viewTitle).toBe("Tasks");
    expect(columnHeaders).toHaveLength(31);
    expect(rows).toEqual([
        {
            title: "User 1",
            isGroup: true,
            pills: [
                { title: "2", colSpan: "01 -> 04 (1/2)" },
                { title: "1", colSpan: "04 (1/2) -> 19" },
                { title: "2", colSpan: "20 -> 20 (1/2)" },
                { title: "1", colSpan: "20 (1/2) -> 31" },
            ],
        },
        {
            title: "Project 1",
            isGroup: true,
            pills: [
                { title: "1", colSpan: "01 -> 19" },
                { title: "2", colSpan: "20 -> 20 (1/2)" },
                { title: "1", colSpan: "20 (1/2) -> 31" },
            ],
        },
        {
            title: "To Do",
            pills: [{ title: "Task 1", colSpan: "01 -> 31", level: 0 }],
        },
        {
            title: "In Progress",
            pills: [{ title: "Task 4", colSpan: "20 -> 20 (1/2)", level: 0 }],
        },
        {
            title: "Project 2",
            isGroup: true,
            pills: [{ title: "1", colSpan: "01 -> 04 (1/2)" }],
        },
        {
            title: "Done",
            pills: [{ title: "Task 5", colSpan: "01 -> 04 (1/2)", level: 0 }],
        },
        {
            title: "User 2",
            isGroup: true,
            pills: [
                { title: "1", colSpan: "17 (1/2) -> 20 (1/2)" },
                { title: "2", colSpan: "20 (1/2) -> 20" },
                { title: "1", colSpan: "21 -> 22 (1/2)" },
                { title: "1", colSpan: "27 -> 31" },
            ],
        },
        {
            title: "Project 1",
            isGroup: true,
            pills: [
                { title: "1", colSpan: "17 (1/2) -> 22 (1/2)" },
                { title: "1", colSpan: "27 -> 31" },
            ],
        },
        {
            title: "Done",
            pills: [{ title: "Task 2", colSpan: "17 (1/2) -> 22 (1/2)", level: 0 }],
        },
        {
            title: "Cancelled",
            pills: [{ title: "Task 3", colSpan: "27 -> 31", level: 0 }],
        },
        {
            title: "Project 2",
            isGroup: true,
            pills: [{ title: "1", colSpan: "20 (1/2) -> 20" }],
        },
        {
            title: "Cancelled",
            pills: [{ title: "Task 7", colSpan: "20 (1/2) -> 20", level: 0 }],
        },
    ]);
    expect(`.o_gantt_group_pill .o_gantt_consolidated_pill`).toHaveStyle({
        backgroundColor: "rgb(113, 75, 103)",
    });
});

test("many2many grouped gantt rendering", async () => {
    Tasks._fields.user_ids = fields.Many2many({ string: "Assignees", relation: "res.users" });
    Tasks._records[0].user_ids = [1, 2];

    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt string="Tasks" date_start="start" date_stop="stop"/>`,
        groupBy: ["user_ids"],
    });
    expect(getActiveScale()).toBe("Month");
    expect(SELECTORS.expandCollapseButtons).toHaveCount(0);

    const { range, viewTitle, columnHeaders, rows } = getGridContent();
    expect(range).toBe("December 2018");
    expect(viewTitle).toBe("Tasks");
    expect(columnHeaders).toHaveLength(31);
    expect(rows).toEqual([
        {
            title: "Undefined Assignees",
            pills: [
                { title: "Task 5", colSpan: "01 -> 04 (1/2)", level: 0 },
                { title: "Task 2", colSpan: "17 (1/2) -> 22 (1/2)", level: 0 },
                { title: "Task 4", colSpan: "20 -> 20 (1/2)", level: 1 },
                { title: "Task 7", colSpan: "20 (1/2) -> 20", level: 1 },
                { title: "Task 3", colSpan: "27 -> 31", level: 0 },
            ],
        },
        {
            title: "User 1",
            pills: [{ title: "Task 1", colSpan: "01 -> 31", level: 0 }],
        },
        {
            title: "User 2",
            pills: [{ title: "Task 1", colSpan: "01 -> 31", level: 0 }],
        },
    ]);
});

test("multi-level grouped with many2many field in gantt view", async () => {
    Tasks._fields.user_ids = fields.Many2many({ string: "Assignees", relation: "res.users" });
    Tasks._records[0].user_ids = [1, 2];

    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt string="Tasks" date_start="start" date_stop="stop"/>`,
        groupBy: ["user_ids", "project_id"],
    });
    expect(getActiveScale()).toBe("Month");
    expect(SELECTORS.expandCollapseButtons).toHaveCount(2);

    const { range, viewTitle, columnHeaders, rows } = getGridContent();
    expect(range).toBe("December 2018");
    expect(viewTitle).toBe("Tasks");
    expect(columnHeaders).toHaveLength(31);
    expect(rows).toEqual([
        {
            title: "Undefined Assignees",
            isGroup: true,
            pills: [
                { title: "1", colSpan: "01 -> 04 (1/2)" },
                { title: "1", colSpan: "17 (1/2) -> 19" },
                { title: "2", colSpan: "20 -> 20 (1/2)" },
                { title: "2", colSpan: "20 (1/2) -> 20" },
                { title: "1", colSpan: "21 -> 22 (1/2)" },
                { title: "1", colSpan: "27 -> 31" },
            ],
        },
        {
            title: "Project 1",
            pills: [
                { title: "Task 2", colSpan: "17 (1/2) -> 22 (1/2)", level: 0 },
                { title: "Task 4", colSpan: "20 -> 20 (1/2)", level: 1 },
                { title: "Task 3", colSpan: "27 -> 31", level: 0 },
            ],
        },
        {
            title: "Project 2",
            pills: [
                { title: "Task 5", colSpan: "01 -> 04 (1/2)", level: 0 },
                { title: "Task 7", colSpan: "20 (1/2) -> 20", level: 0 },
            ],
        },
        {
            title: "User 1",
            isGroup: true,
            pills: [{ title: "1", colSpan: "01 -> 31" }],
        },
        {
            title: "Project 1",
            pills: [{ title: "Task 1", colSpan: "01 -> 31", level: 0 }],
        },
        {
            title: "User 2",
            isGroup: true,
            pills: [{ title: "1", colSpan: "01 -> 31" }],
        },
        {
            title: "Project 1",
            pills: [{ title: "Task 1", colSpan: "01 -> 31", level: 0 }],
        },
    ]);
});

test("full precision gantt rendering", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" default_scale="week" date_stop="stop" precision="{'day':'hour:full', 'week':'day:full', 'month':'day:full'}"/>`,
        groupBy: ["user_id", "project_id"],
    });
    expect(getActiveScale()).toBe("Week");
    expect(SELECTORS.expandCollapseButtons).toHaveCount(2);

    const { range, viewTitle, columnHeaders, rows } = getGridContent();
    expect(range).toBe("16 December 2018 - 22 December 2018");
    expect(viewTitle).toBe("Gantt View");
    expect(columnHeaders).toHaveLength(7);
    expect(rows).toEqual([
        {
            title: "User 1",
            isGroup: true,
            pills: [
                { title: "1", colSpan: "Sunday, 16 -> Wednesday, 19" },
                { title: "2", colSpan: "Thursday, 20 -> Thursday, 20" },
                { title: "1", colSpan: "Friday, 21 -> Saturday, 22" },
            ],
        },
        {
            title: "Project 1",
            pills: [
                { level: 0, colSpan: "Sunday, 16 -> Saturday, 22", title: "Task 1" },
                { level: 1, colSpan: "Thursday, 20 -> Thursday, 20", title: "Task 4" },
            ],
        },
        {
            title: "User 2",
            isGroup: true,
            pills: [
                { title: "1", colSpan: "Monday, 17 -> Wednesday, 19" },
                { title: "2", colSpan: "Thursday, 20 -> Thursday, 20" },
                { title: "1", colSpan: "Friday, 21 -> Saturday, 22" },
            ],
        },
        {
            title: "Project 1",
            pills: [{ level: 0, colSpan: "Monday, 17 -> Saturday, 22", title: "Task 2" }],
        },
        {
            title: "Project 2",
            pills: [{ level: 0, colSpan: "Thursday, 20 -> Thursday, 20", title: "Task 7" }],
        },
    ]);
});

test("gantt rendering, thumbnails", async () => {
    onRpc("get_gantt_data", async () => ({
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
    await mountView({
        resModel: "tasks",
        type: "gantt",
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
    onRpc("get_gantt_data", async () => ({
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
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt string="Tasks" default_scale="week" date_start="start" date_stop="stop" thumbnails="{'user_id': 'image'}"/>`,
    });
    const { rows } = getGridContent();
    expect(rows).toEqual([
        {
            pills: [
                { title: "Task 08:30:00", level: 0, colSpan: "Monday, 17 -> Monday, 17" },
                { title: "Task 14:30:00", level: 1, colSpan: "Monday, 17 (1/2) -> Monday, 17" },
            ],
        },
    ]);
});

test.tags("desktop")("scale switching", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop"/>`,
    });

    // default (month)
    expect(getActiveScale()).toBe("Month");
    expect(SELECTORS.expandCollapseButtons).toHaveCount(0);
    let gridContent = getGridContent();
    expect(gridContent.range).toBe("December 2018");
    expect(gridContent.columnHeaders).toHaveLength(31);
    expect(gridContent.rows).toEqual([
        {
            pills: [
                { title: "Task 5", level: 0, colSpan: "01 -> 04 (1/2)" },
                { title: "Task 1", level: 1, colSpan: "01 -> 31" },
                { title: "Task 2", level: 0, colSpan: "17 (1/2) -> 22 (1/2)" },
                { title: "Task 4", level: 2, colSpan: "20 -> 20 (1/2)" },
                { title: "Task 7", level: 2, colSpan: "20 (1/2) -> 20" },
                { title: "Task 3", level: 0, colSpan: "27 -> 31" },
            ],
        },
    ]);

    // switch to day view
    await setScale("day");

    expect(getActiveScale()).toBe("Day");
    expect(SELECTORS.expandCollapseButtons).toHaveCount(0);
    gridContent = getGridContent();
    expect(gridContent.range).toBe("Thursday, December 20, 2018");
    expect(gridContent.columnHeaders).toHaveLength(24);
    expect(gridContent.rows).toEqual([
        {
            pills: [
                { title: "Task 1", level: 0, colSpan: "12am -> 11pm" },
                { title: "Task 2", level: 1, colSpan: "12am -> 11pm" },
                { title: "Task 4", level: 2, colSpan: "3am -> 7am" },
                { title: "Task 7", level: 2, colSpan: "1pm -> 7pm" },
            ],
        },
    ]);

    // switch to week view
    await setScale("week");

    expect(getActiveScale()).toBe("Week");
    expect(SELECTORS.expandCollapseButtons).toHaveCount(0);
    gridContent = getGridContent();
    expect(gridContent.range).toBe("16 December 2018 - 22 December 2018");
    expect(gridContent.columnHeaders).toHaveLength(7);
    expect(gridContent.rows).toEqual([
        {
            pills: [
                { title: "Task 1", level: 0, colSpan: "Sunday, 16 -> Saturday, 22" },
                {
                    title: "Task 2",
                    level: 1,
                    colSpan: "Monday, 17 (1/2) -> Saturday, 22 (1/2)",
                },
                { title: "Task 4", level: 2, colSpan: "Thursday, 20 -> Thursday, 20 (1/2)" },
                { title: "Task 7", level: 2, colSpan: "Thursday, 20 (1/2) -> Thursday, 20" },
            ],
        },
    ]);

    // switch to month view
    await setScale("month");

    expect(getActiveScale()).toBe("Month");
    expect(SELECTORS.expandCollapseButtons).toHaveCount(0);
    gridContent = getGridContent();
    expect(gridContent.range).toBe("December 2018");
    expect(gridContent.columnHeaders).toHaveLength(31);
    expect(gridContent.rows).toEqual([
        {
            pills: [
                { title: "Task 5", level: 0, colSpan: "01 -> 04 (1/2)" },
                { title: "Task 1", level: 1, colSpan: "01 -> 31" },
                { title: "Task 2", level: 0, colSpan: "17 (1/2) -> 22 (1/2)" },
                { title: "Task 4", level: 2, colSpan: "20 -> 20 (1/2)" },
                { title: "Task 7", level: 2, colSpan: "20 (1/2) -> 20" },
                { title: "Task 3", level: 0, colSpan: "27 -> 31" },
            ],
        },
    ]);

    // switch to year view
    await setScale("year");

    expect(getActiveScale()).toBe("Year");
    expect(SELECTORS.expandCollapseButtons).toHaveCount(0);
    gridContent = getGridContent();
    expect(gridContent.range).toBe("2018");
    expect(gridContent.columnHeaders).toHaveLength(12);
    expect(gridContent.rows).toEqual([
        {
            pills: [
                { title: "Task 5", level: 0, colSpan: "November -> December" },
                { title: "Task 6", level: 1, colSpan: "November -> November" },
                { title: "Task 1", level: 2, colSpan: "November -> December" },
                { title: "Task 2", level: 1, colSpan: "December -> December" },
                { title: "Task 4", level: 3, colSpan: "December -> December" },
                { title: "Task 7", level: 4, colSpan: "December -> December" },
                { title: "Task 3", level: 5, colSpan: "December -> December" },
            ],
        },
    ]);
});

test("today is highlighted", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop"/>`,
    });
    expect(`.o_gantt_header_cell.o_gantt_today`).toHaveCount(1);
    expect(`.o_gantt_header_cell.o_gantt_today`).toHaveText("20");
});

test.tags("desktop")("current month is highlighted'", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: '<gantt date_start="start" date_stop="stop" default_scale="year"/>',
    });
    expect(`.o_gantt_header_cell.o_gantt_today`).toHaveCount(1);
    expect(`.o_gantt_header_cell.o_gantt_today`).toHaveText("December");
});

test.tags("desktop")("current hour is highlighted'", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: '<gantt date_start="start" date_stop="stop" default_scale="day"/>',
    });
    expect(`.o_gantt_header_cell.o_gantt_today`).toHaveCount(1);
    expect(`.o_gantt_header_cell.o_gantt_today`).toHaveText("9am");
});
