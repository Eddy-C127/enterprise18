import { beforeEach, describe, expect, test } from "@odoo/hoot";
import { mockDate } from "@odoo/hoot-mock";
import { onRpc } from "@web/../tests/web_test_helpers";
import { defineGanttModels } from "./gantt_mock_models";
import { SELECTORS, getGridContent, mountGanttView } from "./web_gantt_test_helpers";

describe.current.tags("desktop");

defineGanttModels();
beforeEach(() => mockDate("2018-12-20T08:00:00", +1));

test("empty sparse gantt", async () => {
    await mountGanttView({
        resModel: "tasks",
        arch: `<gantt date_start="start" date_stop="stop" display_mode="sparse" />`,
        domain: [["id", "=", 0]],
    });
    const { viewTitle, range, columnHeaders, rows } = getGridContent();
    expect(viewTitle).toBe("Gantt View");
    expect(range).toBe("From: 12/01/2018 to: 02/28/2019");
    expect(columnHeaders).toHaveLength(34);
    expect(rows).toEqual([{ title: "" }]);
    expect(SELECTORS.noContentHelper).toHaveCount(0);
});

test("sparse gantt", async () => {
    await mountGanttView({
        resModel: "tasks",
        arch: `<gantt date_start="start" date_stop="stop" display_mode="sparse" />`,
        domain: [["id", "=", 1]],
    });
    const { viewTitle, range, columnHeaders, rows } = getGridContent();
    expect(viewTitle).toBe("Gantt View");
    expect(range).toBe("From: 12/01/2018 to: 02/28/2019");
    expect(columnHeaders).toHaveLength(34);
    expect(rows).toEqual([
        {
            pills: [
                {
                    colSpan: "Out of bounds (1)  -> 31 December 2018",
                    level: 0,
                    title: "Task 1",
                },
            ],
            title: "Task 1",
        },
    ]);
    expect(SELECTORS.noContentHelper).toHaveCount(0);
});

test("sparse grouped gantt", async () => {
    await mountGanttView({
        resModel: "tasks",
        arch: `<gantt date_start="start" date_stop="stop" display_mode="sparse" />`,
        groupBy: ["stage"],
    });
    const { viewTitle, range, columnHeaders, rows } = getGridContent();
    expect(viewTitle).toBe("Gantt View");
    expect(range).toBe("From: 12/01/2018 to: 02/28/2019");
    expect(columnHeaders).toHaveLength(34);
    expect(rows).toEqual([
        {
            isGroup: true,
            pills: [
                {
                    colSpan: "Out of bounds (1)  -> 31 December 2018",
                    title: "1",
                },
            ],
            title: "To Do",
        },
        {
            pills: [
                {
                    colSpan: "Out of bounds (1)  -> 31 December 2018",
                    level: 0,
                    title: "Task 1",
                },
            ],
            title: "Task 1",
        },
        {
            isGroup: true,
            pills: [
                {
                    colSpan: "20 December 2018 -> 20 (1/2) December 2018",
                    title: "1",
                },
            ],
            title: "In Progress",
        },
        {
            pills: [
                {
                    colSpan: "20 December 2018 -> 20 (1/2) December 2018",
                    level: 0,
                    title: "Task 4",
                },
            ],
            title: "Task 4",
        },
        {
            isGroup: true,
            pills: [
                {
                    colSpan: "17 (1/2) December 2018 -> 22 (1/2) December 2018",
                    title: "1",
                },
            ],
            title: "Done",
        },
        {
            title: "Task 5",
        },
        {
            pills: [
                {
                    colSpan: "17 (1/2) December 2018 -> 22 (1/2) December 2018",
                    level: 0,
                    title: "Task 2",
                },
            ],
            title: "Task 2",
        },
        {
            isGroup: true,
            pills: [
                {
                    colSpan: "20 (1/2) December 2018 -> 20 December 2018",
                    title: "1",
                },
                {
                    colSpan: "27 December 2018 -> 03 (1/2) January 2019",
                    title: "1",
                },
            ],
            title: "Cancelled",
        },
        {
            pills: [
                {
                    colSpan: "20 (1/2) December 2018 -> 20 December 2018",
                    level: 0,
                    title: "Task 7",
                },
            ],
            title: "Task 7",
        },
        {
            pills: [
                {
                    colSpan: "27 December 2018 -> 03 (1/2) January 2019",
                    level: 0,
                    title: "Task 3",
                },
            ],
            title: "Task 3",
        },
    ]);
    expect(SELECTORS.noContentHelper).toHaveCount(0);
});

test("sparse gantt with consolidation", async () => {
    await mountGanttView({
        resModel: "tasks",
        arch: `
            <gantt
                date_start="start"
                date_stop="stop"
                consolidation="progress"
                consolidation_max="{'user_id': 100}"
                display_mode="sparse"
            />
        `,
        groupBy: ["stage"],
    });
    const { viewTitle, range, columnHeaders, rows } = getGridContent();
    expect(viewTitle).toBe("Gantt View");
    expect(range).toBe("From: 12/01/2018 to: 02/28/2019");
    expect(columnHeaders).toHaveLength(34);
    expect(rows).toEqual([
        {
            isGroup: true,
            pills: [
                {
                    colSpan: "Out of bounds (1)  -> 31 December 2018",
                    title: "1",
                },
            ],
            title: "To Do",
        },
        {
            pills: [
                {
                    colSpan: "Out of bounds (1)  -> 31 December 2018",
                    level: 0,
                    title: "Task 1",
                },
            ],
            title: "Task 1",
        },
        {
            isGroup: true,
            pills: [
                {
                    colSpan: "20 December 2018 -> 20 (1/2) December 2018",
                    title: "1",
                },
            ],
            title: "In Progress",
        },
        {
            pills: [
                {
                    colSpan: "20 December 2018 -> 20 (1/2) December 2018",
                    level: 0,
                    title: "Task 4",
                },
            ],
            title: "Task 4",
        },
        {
            isGroup: true,
            pills: [
                {
                    colSpan: "17 (1/2) December 2018 -> 22 (1/2) December 2018",
                    title: "1",
                },
            ],
            title: "Done",
        },
        {
            title: "Task 5",
        },
        {
            pills: [
                {
                    colSpan: "17 (1/2) December 2018 -> 22 (1/2) December 2018",
                    level: 0,
                    title: "Task 2",
                },
            ],
            title: "Task 2",
        },
        {
            isGroup: true,
            pills: [
                {
                    colSpan: "20 (1/2) December 2018 -> 20 December 2018",
                    title: "1",
                },
                {
                    colSpan: "27 December 2018 -> 03 (1/2) January 2019",
                    title: "1",
                },
            ],
            title: "Cancelled",
        },
        {
            pills: [
                {
                    colSpan: "20 (1/2) December 2018 -> 20 December 2018",
                    level: 0,
                    title: "Task 7",
                },
            ],
            title: "Task 7",
        },
        {
            pills: [
                {
                    colSpan: "27 December 2018 -> 03 (1/2) January 2019",
                    level: 0,
                    title: "Task 3",
                },
            ],
            title: "Task 3",
        },
    ]);
    expect(SELECTORS.noContentHelper).toHaveCount(0);
});

test("sparse gantt with a group expand", async () => {
    onRpc("get_gantt_data", () => {
        return {
            groups: [
                {
                    stage: "todo",
                    __record_ids: [],
                },
                {
                    stage: "in_progress",
                    __record_ids: [4],
                },
            ],
            length: 2,
            records: [
                {
                    display_name: "Task 4",
                    id: 4,
                    progress: 0,
                    stage: "in_progress",
                    start: "2018-12-20 02:30:00",
                    stop: "2018-12-20 06:29:59",
                },
            ],
        };
    });
    await mountGanttView({
        resModel: "tasks",
        arch: `
            <gantt
                date_start="start"
                date_stop="stop"
                display_mode="sparse"
            />
        `,
        groupBy: ["stage"],
    });
    const { viewTitle, range, columnHeaders, rows } = getGridContent();
    expect(viewTitle).toBe("Gantt View");
    expect(range).toBe("From: 12/01/2018 to: 02/28/2019");
    expect(columnHeaders).toHaveLength(34);
    expect(rows).toEqual([
        {
            isGroup: true,
            title: "To Do",
        },
        {
            title: "",
        },
        {
            isGroup: true,
            pills: [
                {
                    colSpan: "20 December 2018 -> 20 (1/2) December 2018",
                    title: "1",
                },
            ],
            title: "In Progress",
        },
        {
            pills: [
                {
                    colSpan: "20 December 2018 -> 20 (1/2) December 2018",
                    level: 0,
                    title: "Task 4",
                },
            ],
            title: "Task 4",
        },
    ]);
    expect(SELECTORS.noContentHelper).toHaveCount(0);
});
