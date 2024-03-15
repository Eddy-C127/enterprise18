import { beforeEach, expect, test } from "@odoo/hoot";
import { leave, queryAll, queryAllTexts, queryFirst } from "@odoo/hoot-dom";
import { animationFrame } from "@odoo/hoot-mock";
import { contains, mountView, onRpc, patchDate } from "@web/../tests/web_test_helpers";
import { Tasks, defineGanttModels } from "./gantt_mock_models";
import {
    SELECTORS,
    clickCell,
    getActiveScale,
    getCell,
    getCellColorProperties,
    getGridContent,
    getPill,
    getPillWrapper,
    hoverGridCell,
    resizePill,
} from "./gantt_test_helpers";

defineGanttModels();

beforeEach(() => {
    patchDate("2018-12-20T07:00:00", 1);
});

test.tags("desktop")("create attribute", async () => {
    Tasks._views.list = `<tree><field name="name"/></tree>`;
    Tasks._views.search = `<search><field name="name"/></search>`;
    onRpc("has_group", () => true);
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" create="0"/>`,
    });
    expect(".o_dialog").toHaveCount(0);
    await hoverGridCell(1, 1);
    await clickCell(1, 1);
    expect(".o_dialog").toHaveCount(1);
    expect(".modal-title").toHaveText("Plan");
    expect(".o_create_button").toHaveCount(0);
});

test("plan attribute", async () => {
    Tasks._views.form = `<form><field name="name"/></form>`;
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" plan="0"/>`,
    });
    expect(".o_dialog").toHaveCount(0);
    await hoverGridCell(1, 1);
    await clickCell(1, 1);
    expect(".o_dialog").toHaveCount(1);
    expect(".modal-title").toHaveText("Create");
});

test("edit attribute", async () => {
    Tasks._views.form = `<form><field name="name"/></form>`;
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" edit="0"/>`,
    });
    expect(SELECTORS.resizable).toHaveCount(0);
    expect(SELECTORS.draggable).toHaveCount(0);
    expect(getGridContent().rows).toEqual([
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

    await contains(getPill("Task 1")).click();
    expect(`.o_popover button.btn-primary`).toHaveText(/view/i);
    await contains(`.o_popover button.btn-primary`).click();
    expect(".modal .o_form_readonly").toHaveCount(1);
});

test("total_row attribute", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" total_row="1"/>`,
    });

    const { rows } = getGridContent();
    expect(rows).toEqual([
        {
            pills: [
                {
                    colSpan: "01 -> 04 (1/2)",
                    level: 0,
                    title: "Task 5",
                },
                {
                    colSpan: "01 -> 31",
                    level: 1,
                    title: "Task 1",
                },
                {
                    colSpan: "17 (1/2) -> 22 (1/2)",
                    level: 0,
                    title: "Task 2",
                },
                {
                    colSpan: "20 -> 20 (1/2)",
                    level: 2,
                    title: "Task 4",
                },
                {
                    colSpan: "20 (1/2) -> 20",
                    level: 2,
                    title: "Task 7",
                },
                {
                    colSpan: "27 -> 31",
                    level: 0,
                    title: "Task 3",
                },
            ],
        },
        {
            isTotalRow: true,
            pills: [
                {
                    colSpan: "01 -> 04 (1/2)",
                    level: 0,
                    title: "2",
                },
                {
                    colSpan: "04 (1/2) -> 17 (1/2)",
                    level: 0,
                    title: "1",
                },
                {
                    colSpan: "17 (1/2) -> 19",
                    level: 0,
                    title: "2",
                },
                {
                    colSpan: "20 -> 20 (1/2)",
                    level: 0,
                    title: "3",
                },
                {
                    colSpan: "20 (1/2) -> 20",
                    level: 0,
                    title: "3",
                },
                {
                    colSpan: "21 -> 22 (1/2)",
                    level: 0,
                    title: "2",
                },
                {
                    colSpan: "22 (1/2) -> 26",
                    level: 0,
                    title: "1",
                },
                {
                    colSpan: "27 -> 31",
                    level: 0,
                    title: "2",
                },
            ],
        },
    ]);
});

test("default_scale attribute", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" default_scale="day"/>`,
    });
    expect(getActiveScale()).toBe("Day");
    const { columnHeaders, range } = getGridContent();
    expect(range).toBe("Thursday, December 20, 2018");
    expect(columnHeaders).toHaveLength(24);
});

test("scales attribute", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" scales="month,day,trololo"/>`,
    });
    await contains(".scale_button_selection").click();
    expect(queryAllTexts`.dropdown-item`).toEqual(["Month", "Day"]);
    expect(getActiveScale()).toBe("Month");
});

test("precision attribute", async () => {
    onRpc("write", (_, { args }) => expect.step(JSON.stringify(args)));
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `
            <gantt
                date_start="start"
                date_stop="stop"
                precision="{'day': 'hour:quarter', 'week': 'day:half', 'month': 'day', 'year': 'month:quarter'}"
                default_scale="day"
            />
        `,
        domain: [["id", "=", 7]],
    });

    // resize of a quarter
    const drop = await resizePill(getPillWrapper("Task 7"), "end", 0.25, false);
    await animationFrame();
    expect(SELECTORS.resizeBadge).toHaveText("+15 minutes");

    // manually trigger the drop to trigger a write
    await drop();
    await animationFrame();
    expect(SELECTORS.resizeBadge).toHaveCount(0);
    expect([JSON.stringify([[7], { stop: "2018-12-20 18:44:59" }])]).toVerifySteps();
});

test("progress attribute", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt string="Tasks" date_start="start" date_stop="stop" progress="progress"/>`,
        groupBy: ["project_id"],
    });
    expect(`${SELECTORS.pill} .o_gantt_progress`).toHaveCount(4);
    expect(
        queryAll(SELECTORS.pill).map((el) => ({
            text: el.innerText,
            progress: el.querySelector(".o_gantt_progress")?.style?.width || null,
        }))
    ).toEqual([
        { text: "Task 1", progress: null },
        { text: "Task 2", progress: "30%" },
        { text: "Task 4", progress: null },
        { text: "Task 3", progress: "60%" },
        { text: "Task 5", progress: "100%" },
        { text: "Task 7", progress: "80%" },
    ]);
});

test("form_view_id attribute", async () => {
    Tasks._views[["form", 42]] = `<form><field name="name"/></form>`;
    onRpc("get_views", (_, { kwargs }) =>
        expect.step(`get_views: ${JSON.stringify(kwargs.views)}`)
    );
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt string="Tasks" date_start="start" date_stop="stop" form_view_id="42"/>`,
        groupBy: ["project_id"],
    });
    await contains(queryFirst(SELECTORS.addButton + ":visible")).click();
    expect(".modal .o_form_view").toHaveCount(1);
    expect([
        `get_views: [[123456789,"gantt"],[987654321,"search"]]`, // initial get_views
        `get_views: [[42,"form"]]`, // get_views when form view dialog opens
    ]).toVerifySteps();
});

test("decoration attribute", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `
            <gantt date_start="start" date_stop="stop" decoration-info="stage == 'todo'">
                <field name="stage"/>
            '</gantt>
        `,
    });
    expect(getPill("Task 1")).toHaveClass("decoration-info");
    expect(getPill("Task 2")).not.toHaveClass("decoration-info");
});

test("decoration attribute with date", async () => {
    patchDate("2018-12-19T12:00:00");
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" decoration-danger="start &lt; today"/>`,
    });
    expect(getPill("Task 1")).toHaveClass("decoration-danger");
    expect(getPill("Task 2")).toHaveClass("decoration-danger");
    expect(getPill("Task 5")).toHaveClass("decoration-danger");
    expect(getPill("Task 3")).not.toHaveClass("decoration-danger");
    expect(getPill("Task 4")).not.toHaveClass("decoration-danger");
    expect(getPill("Task 7")).not.toHaveClass("decoration-danger");
});

test("consolidation feature", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `
            <gantt
                date_start="start"
                date_stop="stop"
                consolidation="progress"
                consolidation_max="{'user_id': 100}"
                consolidation_exclude="exclude"
                progress="progress"
            />
        `,
        groupBy: ["user_id", "project_id", "stage"],
    });

    const { rows } = getGridContent();
    expect(rows).toHaveLength(18);
    expect(rows.filter((r) => r.isGroup)).toHaveLength(12);
    expect(".o_gantt_row_headers").toHaveCount(1);

    // Check grouped rows
    expect(rows[0].isGroup).toBe(true);
    expect(rows[0].title).toBe("User 1");
    expect(rows[9].isGroup).toBe(true);
    expect(rows[9].title).toBe("User 2");

    // Consolidation
    // 0 over the size of Task 5 (Task 5 is 100 but is excluded!) then 0 over the rest of Task 1, cut by Task 4 which has progress 0
    expect(rows[0].pills).toEqual([
        { colSpan: "01 -> 04 (1/2)", title: "0" },
        { colSpan: "04 (1/2) -> 19", title: "0" },
        { colSpan: "20 -> 20 (1/2)", title: "0" },
        { colSpan: "20 (1/2) -> 31", title: "0" },
    ]);

    // 30 over Task 2 until Task 7 then 110 (Task 2 (30) + Task 7 (80)) then 30 again until end of task 2 then 60 over Task 3
    expect(rows[9].pills).toEqual([
        { colSpan: "17 (1/2) -> 20 (1/2)", title: "30" },
        { colSpan: "20 (1/2) -> 20", title: "110" },
        { colSpan: "21 -> 22 (1/2)", title: "30" },
        { colSpan: "27 -> 31", title: "60" },
    ]);

    const withStatus = [];
    for (const el of queryAll(".o_gantt_consolidated_pill")) {
        if (el.classList.contains("bg-success") || el.classList.contains("bg-danger")) {
            withStatus.push({
                title: el.title,
                danger: el.classList.contains("border-danger"),
            });
        }
    }

    expect(withStatus).toEqual([
        { title: "0", danger: false },
        { title: "0", danger: false },
        { title: "0", danger: false },
        { title: "0", danger: false },
        { title: "30", danger: false },
        { title: "110", danger: true },
        { title: "30", danger: false },
        { title: "60", danger: false },
    ]);
});

test("consolidation feature (single level)", async () => {
    Tasks._views.form = `
        <form>
            <field name="name"/>
            <field name="start"/>
            <field name="stop"/>
            <field name="project_id"/>
        </form>
    `;
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" consolidation="progress" consolidation_max="{'user_id': 100}" consolidation_exclude="exclude"/>`,
        groupBy: ["user_id"],
    });

    const { rows, range } = getGridContent();
    expect(range).toBe("December 2018");
    expect(".o_gantt_button_expand_rows").toHaveCount(1);
    expect(rows).toEqual([
        {
            isGroup: true,
            pills: [
                {
                    colSpan: "01 -> 04 (1/2)",
                    title: "0",
                },
                {
                    colSpan: "04 (1/2) -> 19",
                    title: "0",
                },
                {
                    colSpan: "20 -> 20 (1/2)",
                    title: "0",
                },
                {
                    colSpan: "20 (1/2) -> 31",
                    title: "0",
                },
            ],
            title: "User 1",
        },
        {
            pills: [
                {
                    colSpan: "01 -> 04 (1/2)",
                    level: 0,
                    title: "Task 5",
                },
                {
                    colSpan: "01 -> 31",
                    level: 1,
                    title: "Task 1",
                },
                {
                    colSpan: "20 -> 20 (1/2)",
                    level: 0,
                    title: "Task 4",
                },
            ],
            title: "",
        },
        {
            isGroup: true,
            pills: [
                {
                    colSpan: "17 (1/2) -> 20 (1/2)",
                    title: "30",
                },
                {
                    colSpan: "20 (1/2) -> 20",
                    title: "110",
                },
                {
                    colSpan: "21 -> 22 (1/2)",
                    title: "30",
                },
                {
                    colSpan: "27 -> 31",
                    title: "60",
                },
            ],
            title: "User 2",
        },
        {
            pills: [
                {
                    colSpan: "17 (1/2) -> 22 (1/2)",
                    level: 0,
                    title: "Task 2",
                },
                {
                    colSpan: "20 (1/2) -> 20",
                    level: 1,
                    title: "Task 7",
                },
                {
                    colSpan: "27 -> 31",
                    level: 0,
                    title: "Task 3",
                },
            ],
            title: "",
        },
    ]);
});

test("color attribute", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" color="color"/>`,
    });
    expect(getPill("Task 1")).toHaveClass("o_gantt_color_0");
    expect(getPill("Task 2")).toHaveClass("o_gantt_color_2");
});

test("color attribute in multi-level grouped", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" color="color"/>`,
        groupBy: ["user_id", "project_id"],
        domain: [["id", "=", 1]],
    });
    expect(`${SELECTORS.pill}.o_gantt_consolidated_pill`).not.toHaveClass("o_gantt_color_0");
    expect(`${SELECTORS.pill}:not(.o_gantt_consolidated_pill)`).toHaveClass("o_gantt_color_0");
});

test("color attribute on a many2one", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" color="project_id"/>`,
    });
    expect(getPill("Task 1")).toHaveClass("o_gantt_color_1");
    expect(`${SELECTORS.pill}.o_gantt_color_1`).toHaveCount(4);
    expect(`${SELECTORS.pill}.o_gantt_color_2`).toHaveCount(2);
});

test(`Today style with unavailabilities ("week": "day:half")`, async () => {
    const unavailabilities = [
        {
            start: "2018-12-18 10:00:00",
            stop: "2018-12-20 14:00:00",
        },
    ];

    onRpc("gantt_unavailability", (_, { args, model }) => {
        const rows = args[4];
        return rows.map((row) => Object.assign(row, { unavailabilities }));
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" display_unavailability="1" default_scale="week" scales="week" precision="{'week': 'day:half'}"/>`,
    });

    // Normal day / unavailability
    expect(getCellColorProperties(1, 3)).toEqual([
        "--Gantt__Day-background-color",
        "--Gantt__DayOff-background-color",
    ]);

    // Full unavailability
    expect(getCellColorProperties(1, 4)).toEqual(["--Gantt__DayOff-background-color"]);

    // Unavailability / today
    expect(getCell(1, 5)).toHaveClass("o_gantt_today");
    expect(getCellColorProperties(1, 5)).toEqual([
        "--Gantt__DayOff-background-color",
        "--Gantt__DayOffToday-background-color",
    ]);
});

test("Today style of group rows", async () => {
    const unavailabilities = [
        {
            start: "2018-12-18 10:00:00",
            stop: "2018-12-20 14:00:00",
        },
    ];
    Tasks._records = [Tasks._records[3]]; // id: 4

    onRpc("gantt_unavailability", (_, { args }) => {
        const rows = args[4];
        for (const r of rows) {
            r.unavailabilities = unavailabilities;
        }
        return rows;
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" display_unavailability="1" default_scale="week" scales="week" precision="{'week': 'day:half'}"/>`,
        groupBy: ["user_id", "project_id"],
    });

    // Normal group cell: open
    let cell4 = getCell(1, 4, { ignoreHoverableClass: true });
    expect(cell4).not.toHaveClass("o_gantt_today");
    expect(cell4).toHaveClass("o_group_open");
    expect(cell4).toHaveStyle({
        backgroundImage: "linear-gradient(rgb(249, 250, 251), rgb(234, 237, 241))",
    });

    // Today group cell: open
    let cell5 = getCell(1, 5, { ignoreHoverableClass: true });
    expect(cell5).toHaveClass("o_gantt_today");
    expect(cell5).toHaveClass("o_group_open");
    expect(cell5).toHaveStyle({
        backgroundImage: "linear-gradient(rgb(249, 250, 251), rgb(234, 237, 241))",
    });
    await contains(SELECTORS.group).click(); // fold group
    leave();
    // Normal group cell: closed
    cell4 = getCell(1, 4, { ignoreHoverableClass: true });
    expect(cell4).not.toHaveClass("o_gantt_today");
    expect(cell4).not.toHaveClass("o_group_open");
    expect(cell4).toHaveStyle({
        backgroundImage: "linear-gradient(rgb(234, 237, 241), rgb(249, 250, 251))",
    });

    // Today group cell: closed
    cell5 = getCell(1, 5, { ignoreHoverableClass: true });
    expect(cell5).toHaveClass("o_gantt_today");
    expect(cell5).not.toHaveClass("o_group_open");
    expect(cell5).toHaveStyle({ backgroundImage: "none" });
    expect(cell5).toHaveStyle({ backgroundColor: "rgb(252, 250, 243)" });
});

test.tags("desktop")("style without unavailabilities", async () => {
    patchDate("2018-12-05T02:00:00");
    onRpc("gantt_unavailability", (_, { args }) => {
        return args[4];
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" display_unavailability="1"/>`,
    });
    const cell5 = getCell(1, 5);
    expect(cell5).toHaveClass("o_gantt_today");
    expect(cell5).toHaveAttribute("style", "grid-column:9 / span 2;grid-row:1 / span 31;"); // span 31 = 3 level * 9 per level + 4 for general space
    const cell6 = getCell(1, 6);
    expect(cell6).toHaveAttribute("style", "grid-column:11 / span 2;grid-row:1 / span 31;");
});

test(`Unavailabilities ("month": "day:half")`, async () => {
    patchDate("2018-12-05T02:00:00");
    const unavailabilities = [
        {
            start: "2018-12-05 09:30:00",
            stop: "2018-12-07 08:00:00",
        },
        {
            start: "2018-12-16 09:00:00",
            stop: "2018-12-18 13:00:00",
        },
    ];
    onRpc("gantt_unavailability", (_, { args, model }) => {
        expect.step("gantt_unavailability");
        expect(model).toBe("tasks");
        expect(args[0]).toBe("2018-11-30 23:00:00");
        expect(args[1]).toBe("2018-12-31 22:59:59");
        const rows = args[4];
        for (const r of rows) {
            r.unavailabilities = unavailabilities;
        }
        return rows;
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" display_unavailability="1"/>`,
    });
    expect(["gantt_unavailability"]).toVerifySteps();
    expect(getCell(1, 5)).toHaveClass("o_gantt_today");
    expect(getCellColorProperties(1, 5)).toEqual([
        "--Gantt__DayOffToday-background-color",
        "--Gantt__DayOff-background-color",
    ]);
    expect(getCellColorProperties(1, 6)).toEqual(["--Gantt__DayOff-background-color"]);
    expect(getCellColorProperties(1, 7)).toEqual([]);
    expect(getCellColorProperties(1, 16)).toEqual([
        "--Gantt__Day-background-color",
        "--Gantt__DayOff-background-color",
    ]);
    expect(getCellColorProperties(1, 17)).toEqual(["--Gantt__DayOff-background-color"]);
    expect(getCellColorProperties(1, 18)).toEqual([
        "--Gantt__DayOff-background-color",
        "--Gantt__Day-background-color",
    ]);
});

test(`Unavailabilities ("day": "hours:quarter")`, async () => {
    Tasks._records = [];
    const unavailabilities = [
        // in utc
        {
            start: "2018-12-20 08:15:00",
            stop: "2018-12-20 08:30:00",
        },
        {
            start: "2018-12-20 10:35:00",
            stop: "2018-12-20 12:29:00",
        },
        {
            start: "2018-12-20 20:15:00",
            stop: "2018-12-20 20:50:00",
        },
    ];
    onRpc("gantt_unavailability", (_, { args }) => {
        const rows = args[4];
        for (const r of rows) {
            r.unavailabilities = unavailabilities;
        }
        return rows;
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" display_unavailability="1" default_scale="day" scales="day" precision="{'day': 'hours:quarter'}"/>`,
    });
    expect(getCellColorProperties(1, 10)).toEqual([
        "--Gantt__Day-background-color",
        "--Gantt__DayOff-background-color",
        "--Gantt__DayOff-background-color",
        "--Gantt__Day-background-color",
        "--Gantt__Day-background-color",
        "--Gantt__Day-background-color",
    ]);
    expect(getCellColorProperties(1, 12)).toEqual([
        "--Gantt__Day-background-color",
        "--Gantt__Day-background-color",
        "--Gantt__Day-background-color",
        "--Gantt__Day-background-color",
        "--Gantt__Day-background-color",
        "--Gantt__DayOff-background-color",
    ]);
    expect(getCellColorProperties(1, 13)).toEqual(["--Gantt__DayOff-background-color"]);
    expect(getCellColorProperties(1, 14)).toEqual([
        "--Gantt__DayOff-background-color",
        "--Gantt__Day-background-color",
        "--Gantt__Day-background-color",
        "--Gantt__Day-background-color",
        "--Gantt__Day-background-color",
        "--Gantt__Day-background-color",
    ]);
    expect(getCellColorProperties(1, 22)).toEqual([
        "--Gantt__Day-background-color",
        "--Gantt__DayOff-background-color",
        "--Gantt__DayOff-background-color",
        "--Gantt__DayOff-background-color",
        "--Gantt__DayOff-background-color",
        "--Gantt__Day-background-color",
    ]);
});

test("offset attribute", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" offset="-4" default_scale="day"/>`,
    });

    const { range } = getGridContent();
    expect(range).toBe("Sunday, December 16, 2018", {
        message: "gantt view should be set to 4 days before initial date",
    });
});

test("default_group_by attribute", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" default_group_by="user_id"/>`,
    });

    const { rows } = getGridContent();
    expect(rows).toEqual([
        {
            title: "User 1",
            pills: [
                {
                    colSpan: "01 -> 04 (1/2)",
                    level: 0,
                    title: "Task 5",
                },
                {
                    colSpan: "01 -> 31",
                    level: 1,
                    title: "Task 1",
                },
                {
                    colSpan: "20 -> 20 (1/2)",
                    level: 0,
                    title: "Task 4",
                },
            ],
        },
        {
            title: "User 2",
            pills: [
                {
                    colSpan: "17 (1/2) -> 22 (1/2)",
                    level: 0,
                    title: "Task 2",
                },
                {
                    colSpan: "20 (1/2) -> 20",
                    level: 1,
                    title: "Task 7",
                },
                {
                    colSpan: "27 -> 31",
                    level: 0,
                    title: "Task 3",
                },
            ],
        },
    ]);
});

test("default_group_by attribute with groupBy", async () => {
    // The default_group_by attribute should be ignored if a groupBy is given.
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" default_group_by="user_id"/>`,
        groupBy: ["project_id"],
    });

    const { rows } = getGridContent();
    expect(rows).toEqual([
        {
            title: "Project 1",
            pills: [
                {
                    colSpan: "01 -> 31",
                    level: 0,
                    title: "Task 1",
                },
                {
                    colSpan: "17 (1/2) -> 22 (1/2)",
                    level: 1,
                    title: "Task 2",
                },
                {
                    colSpan: "20 -> 20 (1/2)",
                    level: 2,
                    title: "Task 4",
                },
                {
                    colSpan: "27 -> 31",
                    level: 1,
                    title: "Task 3",
                },
            ],
        },
        {
            title: "Project 2",
            pills: [
                {
                    colSpan: "01 -> 04 (1/2)",
                    level: 0,
                    title: "Task 5",
                },
                {
                    colSpan: "20 (1/2) -> 20",
                    level: 0,
                    title: "Task 7",
                },
            ],
        },
    ]);
});

test("default_group_by attribute with 2 fields", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" default_group_by="user_id,project_id"/>`,
    });

    const { rows } = getGridContent();
    expect(rows).toEqual([
        {
            title: "User 1",
            isGroup: true,
            pills: [
                {
                    colSpan: "01 -> 04 (1/2)",
                    title: "2",
                },
                {
                    colSpan: "04 (1/2) -> 19",
                    title: "1",
                },
                {
                    colSpan: "20 -> 20 (1/2)",
                    title: "2",
                },
                {
                    colSpan: "20 (1/2) -> 31",
                    title: "1",
                },
            ],
        },
        {
            title: "Project 1",
            pills: [
                {
                    colSpan: "01 -> 31",
                    level: 0,
                    title: "Task 1",
                },
                {
                    colSpan: "20 -> 20 (1/2)",
                    level: 1,
                    title: "Task 4",
                },
            ],
        },
        {
            title: "Project 2",
            pills: [
                {
                    colSpan: "01 -> 04 (1/2)",
                    level: 0,
                    title: "Task 5",
                },
            ],
        },
        {
            title: "User 2",
            isGroup: true,
            pills: [
                {
                    colSpan: "17 (1/2) -> 20 (1/2)",
                    title: "1",
                },
                {
                    colSpan: "20 (1/2) -> 20",
                    title: "2",
                },
                {
                    colSpan: "21 -> 22 (1/2)",
                    title: "1",
                },
                {
                    colSpan: "27 -> 31",
                    title: "1",
                },
            ],
        },
        {
            title: "Project 1",
            pills: [
                {
                    colSpan: "17 (1/2) -> 22 (1/2)",
                    level: 0,
                    title: "Task 2",
                },
                {
                    colSpan: "27 -> 31",
                    level: 0,
                    title: "Task 3",
                },
            ],
        },
        {
            title: "Project 2",
            pills: [
                {
                    colSpan: "20 (1/2) -> 20",
                    level: 0,
                    title: "Task 7",
                },
            ],
        },
    ]);
});

test("dynamic_range attribute", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" default_group_by="user_id" dynamic_range="1" default_scale="month"/>`,
    });

    const { columnHeaders } = getGridContent();
    expect(columnHeaders).toEqual([
        "20",
        "21",
        "22",
        "23",
        "24",
        "25",
        "26",
        "27",
        "28",
        "29",
        "30",
        "31",
        "01",
        "02",
        "03",
        "04",
        "05",
        "06",
        "07",
        "08",
        "09",
        "10",
        "11",
        "12",
        "13",
        "14",
        "15",
        "16",
        "17",
        "18",
        "19",
    ]);
});
