import { beforeEach, expect, test } from "@odoo/hoot";
import { queryAll, queryAllTexts, queryFirst, queryText } from "@odoo/hoot-dom";
import { onRendered, useEffect, useRef } from "@odoo/owl";
import {
    contains,
    fields,
    getService,
    mountView,
    mountWithCleanup,
    onRpc,
    pagerNext,
    patchDate,
    patchTimeZone,
    patchWithCleanup,
    toggleMenuItem,
    toggleSearchBarMenu,
} from "@web/../tests/web_test_helpers";
import { Tasks, defineGanttModels } from "./gantt_mock_models";
import {
    CLASSES,
    SELECTORS,
    clickCell,
    dragPill,
    editPill,
    getGridContent,
    hoverGridCell,
    setScale,
} from "./gantt_test_helpers";

import { Domain } from "@web/core/domain";
import { WebClient } from "@web/webclient/webclient";
import { GanttController } from "@web_gantt/gantt_controller";
import { GanttRenderer } from "@web_gantt/gantt_renderer";
import { GanttRowProgressBar } from "@web_gantt/gantt_row_progress_bar";

// Hard-coded daylight saving dates from 2019
const DST_DATES = {
    winterToSummer: {
        before: "2019-03-30",
        after: "2019-03-31",
    },
    summerToWinter: {
        before: "2019-10-26",
        after: "2019-10-27",
    },
};

defineGanttModels();

beforeEach(() => {
    patchDate("2018-12-20T08:00:00", +1);
});

test("DST spring forward", async () => {
    patchTimeZone("Europe/Brussels");
    Tasks._records = [
        {
            id: 1,
            name: "DST Task 1",
            start: `${DST_DATES.winterToSummer.before} 03:00:00`,
            stop: `${DST_DATES.winterToSummer.before} 03:30:00`,
        },
        {
            id: 2,
            name: "DST Task 2",
            start: `${DST_DATES.winterToSummer.after} 03:00:00`,
            stop: `${DST_DATES.winterToSummer.after} 03:30:00`,
        },
    ];
    await mountView({
        type: "gantt",
        resModel: "tasks",
        arch: `<gantt date_start="start" date_stop="stop" default_scale="day"/>`,
        context: {
            initialDate: `${DST_DATES.winterToSummer.before} 08:00:00`,
        },
    });

    let content = getGridContent();
    expect(content.columnHeaders.slice(0, 4)).toEqual(["12am", "1am", "2am", "3am"]);
    expect(content.rows[0].pills).toEqual([
        {
            colSpan: "4am -> 4am",
            level: 0,
            title: "DST Task 1",
        },
    ]);

    await contains(SELECTORS.nextButton).click();
    content = getGridContent();
    expect(content.columnHeaders.slice(0, 4)).toEqual(["12am", "1am", "3am", "4am"]);
    expect(content.rows[0].pills).toEqual([
        {
            colSpan: "5am -> 5am",
            level: 0,
            title: "DST Task 2",
        },
    ]);
});

test("DST fall back", async () => {
    patchTimeZone("Europe/Brussels");
    Tasks._records = [
        {
            id: 1,
            name: "DST Task 1",
            start: `${DST_DATES.summerToWinter.before} 03:00:00`,
            stop: `${DST_DATES.summerToWinter.before} 03:30:00`,
        },
        {
            id: 2,
            name: "DST Task 2",
            start: `${DST_DATES.summerToWinter.after} 03:00:00`,
            stop: `${DST_DATES.summerToWinter.after} 03:30:00`,
        },
    ];
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" default_scale="day"/>`,
        context: {
            initialDate: `${DST_DATES.summerToWinter.before} 08:00:00`,
        },
    });

    let content = getGridContent();
    expect(content.columnHeaders.slice(0, 4)).toEqual(["12am", "1am", "2am", "3am"]);
    expect(content.rows[0].pills).toEqual([
        {
            colSpan: "5am -> 5am",
            level: 0,
            title: "DST Task 1",
        },
    ]);

    await contains(SELECTORS.nextButton).click();
    content = getGridContent();
    expect(content.columnHeaders.slice(0, 4)).toEqual(["12am", "1am", "2am", "2am"]);
    expect(content.rows[0].pills).toEqual([
        {
            colSpan: "4am -> 4am",
            level: 0,
            title: "DST Task 2",
        },
    ]);
});

test.tags("desktop")("Records spanning across DST should be displayed normally", async () => {
    patchTimeZone("Europe/Brussels");
    Tasks._records = [
        {
            id: 1,
            name: "DST Task 1",
            start: `${DST_DATES.winterToSummer.before} 03:00:00`,
            stop: `${DST_DATES.winterToSummer.after} 03:30:00`,
        },
        {
            id: 2,
            name: "DST Task 2",
            start: `${DST_DATES.summerToWinter.before} 03:00:00`,
            stop: `${DST_DATES.summerToWinter.after} 03:30:00`,
        },
    ];
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" default_scale="year"/>`,
        context: {
            initialDate: `${DST_DATES.summerToWinter.before} 08:00:00`,
        },
    });
    expect(getGridContent().rows).toEqual([
        {
            pills: [
                { title: "DST Task 1", colSpan: "March -> March", level: 0 },
                { title: "DST Task 2", colSpan: "October -> October", level: 0 },
            ],
        },
    ]);
});

test("delete attribute on dialog", async () => {
    Tasks._views.form = `
        <form>
            <field name="name"/>
            <field name="start"/>
            <field name="stop"/>
            <field name="stage"/>
            <field name="project_id"/>
            <field name="user_id"/>
        </form>
    `;
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" delete="0"/>`,
    });
    await editPill("Task 1");
    expect(".modal").toHaveCount(1);
    expect(".o_form_button_remove").toHaveCount(0);
});

test("move a pill in multi-level grop row after collapse and expand grouped row", async () => {
    onRpc("write", (_, { args }) => {
        expect.step("write");
        expect(args).toEqual([
            [7],
            {
                project_id: 1,
                start: "2018-12-02 12:30:12",
                stop: "2018-12-02 18:29:59",
            },
        ]);
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" />`,
        groupBy: ["project_id", "stage"],
        domain: [["id", "in", [1, 7]]],
    });
    expect(getGridContent().rows.length).toBe(4);

    // collapse the first group
    await contains(`${SELECTORS.rowHeader}${SELECTORS.group}:nth-child(1)`).click();
    expect(`${SELECTORS.rowHeader}:nth-child(1)`).not.toHaveClass("o_group_open");
    // expand the first group
    await contains(`${SELECTORS.rowHeader}${SELECTORS.group}:nth-child(1)`).click();
    expect(`${SELECTORS.rowHeader}:nth-child(1)`).toHaveClass("o_group_open");

    // move a pill (task 7) in the other row and in the day 2
    const { drop } = await dragPill("Task 7");
    await drop({ row: 1, column: 2, part: 2 });
    expect(["write"]).toVerifySteps();
    expect(getGridContent().rows.filter((x) => x.isGroup).length).toBe(1);
});

test.tags("desktop")(
    "plan dialog initial domain has the action domain as its only base",
    async () => {
        Tasks._views = {
            gantt: `<gantt date_start="start" date_stop="stop"/>`,
            list: `<tree><field name="name"/></tree>`,
            search: `
            <search>
                <filter name="project_one" string="Project 1" domain="[('project_id', '=', 1)]"/>
            </search>
        `,
        };
        onRpc("get_gantt_data", (_, { kwargs }) => expect.step(kwargs.domain.toString()));
        onRpc("web_search_read", (_, { kwargs }) => expect.step(kwargs.domain.toString()));
        await mountWithCleanup(WebClient);
        const ganttAction = {
            name: "Tasks Gantt",
            res_model: "tasks",
            type: "ir.actions.act_window",
            views: [[false, "gantt"]],
        };

        // Load action without domain and open plan dialog
        await getService("action").doAction(ganttAction);
        expect(["&,start,<=,2018-12-31 22:59:59,stop,>=,2018-11-30 23:00:00"]).toVerifySteps();
        await hoverGridCell(1, 10);
        await clickCell(1, 10);
        expect(["|,start,=,false,stop,=,false"]).toVerifySteps();

        // Load action WITH domain and open plan dialog
        await getService("action").doAction({
            ...ganttAction,
            domain: [["project_id", "=", 1]],
        });
        expect([
            "&,project_id,=,1,&,start,<=,2018-12-31 22:59:59,stop,>=,2018-11-30 23:00:00",
        ]).toVerifySteps();

        await hoverGridCell(1, 10);
        await clickCell(1, 10);
        expect(["&,project_id,=,1,|,start,=,false,stop,=,false"]).toVerifySteps();

        // Load action without domain, activate a filter and then open plan dialog
        await getService("action").doAction(ganttAction);
        expect(["&,start,<=,2018-12-31 22:59:59,stop,>=,2018-11-30 23:00:00"]).toVerifySteps();

        await toggleSearchBarMenu();
        await toggleMenuItem("Project 1");
        expect([
            "&,project_id,=,1,&,start,<=,2018-12-31 22:59:59,stop,>=,2018-11-30 23:00:00",
        ]).toVerifySteps();

        await hoverGridCell(1, 10);
        await clickCell(1, 10);
        expect(["|,start,=,false,stop,=,false"]).toVerifySteps();
    }
);

test.tags("desktop")("No progress bar when no option set.", async () => {
    onRpc("gantt_progress_bar", () => {
        throw new Error("Method should not be called");
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" default_scale="week" scales="week"/>`,
    });
    expect(SELECTORS.progressBar).toHaveCount(0);
});

test.tags("desktop")("Progress bar rpc is triggered when option set.", async () => {
    onRpc("gantt_progress_bar", (_, { model, args }) => {
        expect.step("gantt_progress_bar");
        expect(model).toBe("tasks");
        expect(args[0]).toEqual(["user_id"]);
        expect(args[1]).toEqual({ user_id: [1, 2] });
        return {
            user_id: {
                1: { value: 50, max_value: 100 },
                2: { value: 25, max_value: 200 },
            },
        };
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `
            <gantt date_start="start" date_stop="stop" default_scale="week" scales="week" default_group_by="user_id" progress_bar="user_id">
                <field name="user_id"/>
            </gantt>
        `,
    });
    expect(["gantt_progress_bar"]).toVerifySteps();
    expect(SELECTORS.progressBar).toHaveCount(2);
    const [progressBar1, progressBar2] = queryAll(SELECTORS.progressBar);
    expect(progressBar1).toHaveClass("o_gantt_group_success");
    expect(progressBar2).toHaveClass("o_gantt_group_success");
    const [rowHeader1, rowHeader2] = [progressBar1.parentElement, progressBar2.parentElement];
    expect(rowHeader1.matches(SELECTORS.rowHeader)).toBeTruthy();
    expect(rowHeader2.matches(SELECTORS.rowHeader)).toBeTruthy();
    expect(rowHeader1).not.toHaveClass(CLASSES.group);
    expect(rowHeader2).not.toHaveClass(CLASSES.group);
    expect(queryAll(SELECTORS.progressBarBackground).map((el) => el.style.width)).toEqual([
        "50%",
        "12.5%",
    ]);
    await hoverGridCell(1, 1);
    expect(SELECTORS.progressBarForeground).toHaveText("50h / 100h");
    await hoverGridCell(2, 1);
    expect(SELECTORS.progressBarForeground).toHaveText("25h / 200h");
});

test("Progress bar component will not render when hovering cells of the same row", async () => {
    patchWithCleanup(GanttRowProgressBar.prototype, {
        setup() {
            onRendered(() => expect.step("rendering progress bar"));
        },
    });
    onRpc("gantt_progress_bar", () => ({
        user_id: {
            1: { value: 50, max_value: 100 },
            2: { value: 25, max_value: 200 },
        },
    }));
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `
                <gantt date_start="start" date_stop="stop" default_scale="week" scales="week" default_group_by="user_id" progress_bar="user_id">
                    <field name="user_id"/>
                </gantt>
            `,
    });
    expect(["rendering progress bar", "rendering progress bar"]).toVerifySteps();
    await hoverGridCell(1, 4);
    expect(["rendering progress bar", "rendering progress bar"]).toVerifySteps();
    await hoverGridCell(1, 3);
    await hoverGridCell(2, 3);
    expect(["rendering progress bar", "rendering progress bar"]).toVerifySteps();
});

test.tags("desktop")("Progress bar when multilevel grouped.", async () => {
    // Here the view is grouped twice on the same field.
    // This is not a common use case, but it is possible to achieve it
    // bu saving a default favorite with a groupby then apply it twice
    // on the same field through the groupby menu.
    // In this case, the progress bar should be displayed only once,
    // on the first level of grouping.
    onRpc("gantt_progress_bar", (_, { model, args }) => {
        expect.step("gantt_progress_bar");
        expect(model).toBe("tasks");
        expect(args[0]).toEqual(["user_id"]);
        expect(args[1]).toEqual({ user_id: [1, 2] });
        return {
            user_id: {
                1: { value: 50, max_value: 100 },
                2: { value: 25, max_value: 200 },
            },
        };
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `
            <gantt date_start="start" date_stop="stop" default_scale="week" scales="week" default_group_by="user_id,user_id" progress_bar="user_id">
                <field name="user_id"/>
            </gantt>
        `,
    });
    expect(["gantt_progress_bar"]).toVerifySteps();
    expect(SELECTORS.progressBar).toHaveCount(2);
    const [progressBar1, progressBar2] = queryAll(SELECTORS.progressBar);
    expect(progressBar1).toHaveClass("o_gantt_group_success");
    expect(progressBar2).toHaveClass("o_gantt_group_success");
    const [rowHeader1, rowHeader2] = [progressBar1.parentElement, progressBar2.parentElement];
    expect(rowHeader1.matches(SELECTORS.rowHeader)).toBeTruthy();
    expect(rowHeader2.matches(SELECTORS.rowHeader)).toBeTruthy();
    expect(rowHeader1).toHaveClass(CLASSES.group);
    expect(rowHeader2).toHaveClass(CLASSES.group);
    expect(queryAll(SELECTORS.progressBarBackground).map((el) => el.style.width)).toEqual([
        "50%",
        "12.5%",
    ]);
    await hoverGridCell(1, 1);
    expect(SELECTORS.progressBarForeground).toHaveText("50h / 100h");
    await hoverGridCell(3, 1);
    expect(SELECTORS.progressBarForeground).toHaveText("25h / 200h");
});

test.tags("desktop")("Progress bar warning when max_value is zero", async () => {
    onRpc("gantt_progress_bar", (_, { model, args }) => {
        expect.step("gantt_progress_bar");
        expect(model).toBe("tasks");
        expect(args[0]).toEqual(["user_id"]);
        expect(args[1]).toEqual({ user_id: [1, 2] });
        return {
            user_id: {
                1: { value: 50, max_value: 0 },
                warning: "plop",
            },
        };
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `
            <gantt date_start="start" date_stop="stop" default_scale="week" scales="week" default_group_by="user_id" progress_bar="user_id">
                <field name="user_id"/>
            </gantt>
        `,
    });
    expect(["gantt_progress_bar"]).toVerifySteps();
    expect(SELECTORS.progressBarWarning).toHaveCount(0);
    await hoverGridCell(1, 1);
    expect(SELECTORS.progressBarWarning).toHaveCount(1);
    expect(queryFirst(SELECTORS.progressBarWarning).parentElement.textContent).toBe("50h");
    expect(queryFirst(SELECTORS.progressBarWarning).parentElement.title).toBe("plop");
});

test("Progress bar when value less than hour", async () => {
    onRpc("gantt_progress_bar", (_, { model, args }) => {
        expect.step("gantt_progress_bar");
        expect(model).toBe("tasks");
        expect(args[0]).toEqual(["user_id"]);
        expect(args[1]).toEqual({ user_id: [1, 2] });
        return {
            user_id: {
                1: { value: 0.5, max_value: 100 },
            },
        };
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `
            <gantt date_start="start" date_stop="stop" default_scale="week" scales="week" default_group_by="user_id" progress_bar="user_id">
                <field name="user_id"/>
            </gantt>
        `,
    });
    expect(["gantt_progress_bar"]).toVerifySteps();
    expect(SELECTORS.progressBar).toHaveCount(1);
    await hoverGridCell(1, 1);
    expect(SELECTORS.progressBarForeground).toHaveText("0h30 / 100h");
});

test("Progress bar danger when ratio > 100", async () => {
    onRpc("gantt_progress_bar", (_, { model, args }) => {
        expect.step("gantt_progress_bar");
        expect(model).toBe("tasks");
        expect(args[0]).toEqual(["user_id"]);
        expect(args[1]).toEqual({ user_id: [1, 2] });
        return {
            user_id: {
                1: { value: 150, max_value: 100 },
            },
        };
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `
            <gantt date_start="start" date_stop="stop" default_scale="week" scales="week" default_group_by="user_id" progress_bar="user_id">
                <field name="user_id"/>
            </gantt>
        `,
    });
    expect(["gantt_progress_bar"]).toVerifySteps();
    expect(SELECTORS.progressBar).toHaveCount(1);
    expect(SELECTORS.progressBarBackground).toHaveStyle("100%");
    expect(SELECTORS.progressBar).toHaveClass("o_gantt_group_danger");
    await hoverGridCell(1, 1);
    expect(queryFirst(SELECTORS.progressBarForeground).parentElement).toHaveClass("text-bg-danger");
    expect(SELECTORS.progressBarForeground).toHaveText("150h / 100h");
});

test("Falsy search field will return an empty rows", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `
            <gantt date_start="start" date_stop="stop" default_scale="week" scales="week" progress_bar="user_id">
                <field name="user_id"/>
            </gantt>
        `,
        groupBy: ["project_id", "user_id"],
        domain: [["id", "=", 5]],
    });
    expect(".o_gantt_row_sidebar_empty").toHaveCount(1);
    expect(SELECTORS.progressBar).toHaveCount(0);
});

test.tags("desktop")("Search field return rows with progressbar", async () => {
    onRpc("gantt_progress_bar", (_, { model, args }) => {
        expect.step("gantt_progress_bar");
        expect(model).toBe("tasks");
        expect(args[0]).toEqual(["user_id"]);
        expect(args[1]).toEqual({ user_id: [2] });
        return {
            user_id: {
                2: { value: 25, max_value: 200 },
            },
        };
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `
            <gantt date_start="start" date_stop="stop" default_scale="week" scales="week" progress_bar="user_id">
                <field name="user_id"/>
            </gantt>
        `,
        groupBy: ["project_id", "user_id"],
        domain: [["id", "=", 2]],
    });
    expect(["gantt_progress_bar"]).toVerifySteps();
    const { rows } = getGridContent();
    expect(rows.map((r) => r.title)).toEqual(["Project 1", "User 2"]);
    expect(SELECTORS.progressBar).toHaveCount(1);
    expect(SELECTORS.progressBarBackground).toHaveStyle("12.5%");
});

test("add record in empty gantt", async () => {
    Tasks._records = [];
    Tasks._fields.stage_id.domain = "[('id', '!=', False)]";
    Tasks._views.form = `
        <form>
            <field name="stage_id" widget="statusbar"/>
            <field name="project_id"/>
            <field name="start"/>
            <field name="stop"/>
        </form>
    `;
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" plan="false"/>`,
        groupBy: ["project_id"],
    });
    await hoverGridCell(1, 10);
    await clickCell(1, 10);
    expect(".modal").toHaveCount(1);
});

test("Only the task name appears in the pill title when the pill_label option is not set", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" default_scale="week" scales="week"/>`,
    });
    expect(queryAllTexts(SELECTORS.pill)).toEqual([
        "Task 1", // the pill should not include DateTime in the title
        "Task 2",
        "Task 4",
        "Task 7",
    ]);
});

test("The date and task name appears in the pill title when the pill_label option is set", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" default_scale="week" scales="week" pill_label="True"/>`,
    });
    expect(queryAllTexts(SELECTORS.pill)).toEqual([
        "11/30 - 12/31 - Task 1", // the task span across in week then DateTime should be displayed on the pill label
        "Task 2", // the task does not span across in week scale then DateTime shouldn't be displayed on the pill label
        "Task 4",
        "Task 7",
    ]);
});

test.tags("desktop")(
    "A task should always have a title (pill_label='1', scale 'week')",
    async () => {
        Tasks._fields.allocated_hours = fields.Float({ string: "Allocated Hours" });
        Tasks._records = [
            {
                id: 1,
                name: "Task 1",
                start: "2018-12-17 08:30:00",
                stop: "2018-12-17 19:30:00", // span only one day
                allocated_hours: 0,
            },
            {
                id: 2,
                name: "Task 2",
                start: "2018-12-18 08:30:00",
                stop: "2018-12-18 19:30:00", // span only one day
                allocated_hours: 6,
            },
            {
                id: 3,
                name: "Task 3",
                start: "2018-12-18 08:30:00",
                stop: "2018-12-19 19:30:00", // span two days
                allocated_hours: 6,
            },
            {
                id: 4,
                name: "Task 4",
                start: "2018-12-08 08:30:00",
                stop: "2019-02-18 19:30:00", // span two weeks
                allocated_hours: 6,
            },
            {
                id: 5,
                name: "Task 5",
                start: "2018-12-18 08:30:00",
                stop: "2019-02-18 19:30:00", // span two months
                allocated_hours: 6,
            },
        ];
        await mountView({
            resModel: "tasks",
            type: "gantt",
            arch: `
            <gantt date_start="start" date_stop="stop" pill_label="True" default_scale="week">
                <field name="allocated_hours"/>
            </gantt>
        `,
        });
        const titleMapping = [
            { name: "Task 4", title: "12/8 - 2/18 - Task 4" },
            { name: "Task 1", title: "Task 1" },
            { name: "Task 2", title: "9:30 AM - 8:30 PM (6h) - Task 2" },
            { name: "Task 3", title: "Task 3" },
            { name: "Task 5", title: "12/18 - 2/18 - Task 5" },
        ];
        expect(queryAllTexts(".o_gantt_pill")).toEqual(titleMapping.map((e) => e.title));
        const pills = queryAll(".o_gantt_pill");
        for (let i = 0; i < pills.length; i++) {
            await contains(pills[i]).click();
            expect(queryText(".o_popover .popover-header")).toBe(titleMapping[i].name);
        }
    }
);

test.tags("desktop")(
    "A task should always have a title (pill_label='1', scale 'month')",
    async () => {
        Tasks._fields.allocated_hours = fields.Float({ string: "Allocated Hours" });
        Tasks._records = [
            {
                id: 1,
                name: "Task 1",
                start: "2018-12-15 08:30:00",
                stop: "2018-12-15 19:30:00", // span only one day
                allocated_hours: 0,
            },
            {
                id: 2,
                name: "Task 2",
                start: "2018-12-16 08:30:00",
                stop: "2018-12-16 19:30:00", // span only one day
                allocated_hours: 6,
            },
            {
                id: 3,
                name: "Task 3",
                start: "2018-12-16 08:30:00",
                stop: "2018-12-17 18:30:00", // span two days
                allocated_hours: 6,
            },
            {
                id: 4,
                name: "Task 4",
                start: "2018-12-16 08:30:00",
                stop: "2019-02-18 19:30:00", // span two months
                allocated_hours: 6,
            },
        ];
        await mountView({
            resModel: "tasks",
            type: "gantt",
            arch: `
            <gantt date_start="start" date_stop="stop" pill_label="True">
                <field name="allocated_hours"/>
            </gantt>
        `,
        });
        const titleMapping = [
            { name: "Task 1", title: "Task 1" },
            { name: "Task 2", title: "9:30 AM - 8:30 PM (6h)" },
            { name: "Task 3", title: "Task 3" },
            { name: "Task 4", title: "12/16 - 2/18 - Task 4" },
        ];
        expect(queryAllTexts(".o_gantt_pill")).toEqual(titleMapping.map((e) => e.title));
        const pills = queryAll(".o_gantt_pill");
        for (let i = 0; i < pills.length; i++) {
            await contains(pills[i]).click();
            expect(queryText(".o_popover .popover-header")).toBe(titleMapping[i].name);
        }
    }
);

test("position of no content help in sample mode", async () => {
    patchWithCleanup(GanttController.prototype, {
        setup() {
            super.setup(...arguments);
            const rootRef = useRef("root");
            useEffect(() => {
                rootRef.el.querySelector(".o_content.o_view_sample_data").style.position =
                    "relative";
            });
        },
    });
    patchWithCleanup(GanttRenderer.prototype, {
        isDisabled(row) {
            if (this.visibleRows.indexOf(row) === 0) {
                return false;
            }
            return true;
        },
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" sample="1"/>`,
        groupBy: ["user_id"],
        domain: Domain.FALSE.toList(),
    });
    expect(".o_view_nocontent").toHaveCount(1);
    expect(".o_gantt_row_header").not.toHaveClass("o_sample_data_disabled");
    const noContentHelp = queryFirst(".o_view_nocontent");
    const noContentHelpTop = noContentHelp.getBoundingClientRect().top;
    const firstRowHeader = queryFirst(".o_gantt_row_header");
    const firstRowHeaderBottom = firstRowHeader.getBoundingClientRect().bottom;
    expect(noContentHelpTop - firstRowHeaderBottom).toBeLessThan(3);
});

test("gantt view grouped by a boolean field: row titles should be 'True' or 'False'", async () => {
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop"/>`,
        groupBy: ["exclude"],
    });
    expect(getGridContent().rows.map((r) => r.title)).toEqual(["False", "True"]);
});

test("date grid and dst winterToSummer (1 cell part)", async () => {
    let renderer;
    patchWithCleanup(GanttRenderer.prototype, {
        setup() {
            super.setup(...arguments);
            renderer = this;
        },
    });

    patchTimeZone("Europe/Brussels");
    Tasks._records = [];

    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" default_scale="day" precision="{'day':'hour:full', 'week':'day:full', 'month':'day:full', 'year':'month:full' }"/>`,
        domain: [["id", "=", 8]],
        context: {
            initialDate: `${DST_DATES.winterToSummer.before} 08:00:00`,
        },
    });

    function getGridInfo() {
        return renderer.dateGridColumns.map((d) => d.toString());
    }
    expect(getGridInfo()).toEqual([
        "2019-03-30T00:00:00.000+01:00",
        "2019-03-30T01:00:00.000+01:00",
        "2019-03-30T02:00:00.000+01:00",
        "2019-03-30T03:00:00.000+01:00",
        "2019-03-30T04:00:00.000+01:00",
        "2019-03-30T05:00:00.000+01:00",
        "2019-03-30T06:00:00.000+01:00",
        "2019-03-30T07:00:00.000+01:00",
        "2019-03-30T08:00:00.000+01:00",
        "2019-03-30T09:00:00.000+01:00",
        "2019-03-30T10:00:00.000+01:00",
        "2019-03-30T11:00:00.000+01:00",
        "2019-03-30T12:00:00.000+01:00",
        "2019-03-30T13:00:00.000+01:00",
        "2019-03-30T14:00:00.000+01:00",
        "2019-03-30T15:00:00.000+01:00",
        "2019-03-30T16:00:00.000+01:00",
        "2019-03-30T17:00:00.000+01:00",
        "2019-03-30T18:00:00.000+01:00",
        "2019-03-30T19:00:00.000+01:00",
        "2019-03-30T20:00:00.000+01:00",
        "2019-03-30T21:00:00.000+01:00",
        "2019-03-30T22:00:00.000+01:00",
        "2019-03-30T23:00:00.000+01:00",
        "2019-03-31T00:00:00.000+01:00",
    ]);

    await contains(SELECTORS.nextButton).click();
    expect(getGridInfo()).toEqual([
        "2019-03-31T00:00:00.000+01:00",
        "2019-03-31T01:00:00.000+01:00",
        "2019-03-31T03:00:00.000+02:00",
        "2019-03-31T04:00:00.000+02:00",
        "2019-03-31T05:00:00.000+02:00",
        "2019-03-31T06:00:00.000+02:00",
        "2019-03-31T07:00:00.000+02:00",
        "2019-03-31T08:00:00.000+02:00",
        "2019-03-31T09:00:00.000+02:00",
        "2019-03-31T10:00:00.000+02:00",
        "2019-03-31T11:00:00.000+02:00",
        "2019-03-31T12:00:00.000+02:00",
        "2019-03-31T13:00:00.000+02:00",
        "2019-03-31T14:00:00.000+02:00",
        "2019-03-31T15:00:00.000+02:00",
        "2019-03-31T16:00:00.000+02:00",
        "2019-03-31T17:00:00.000+02:00",
        "2019-03-31T18:00:00.000+02:00",
        "2019-03-31T19:00:00.000+02:00",
        "2019-03-31T20:00:00.000+02:00",
        "2019-03-31T21:00:00.000+02:00",
        "2019-03-31T22:00:00.000+02:00",
        "2019-03-31T23:00:00.000+02:00",
        "2019-04-01T00:00:00.000+02:00",
    ]);

    await setScale("week");
    expect(getGridInfo()).toEqual([
        "2019-03-31T00:00:00.000+01:00",
        "2019-04-01T00:00:00.000+02:00",
        "2019-04-02T00:00:00.000+02:00",
        "2019-04-03T00:00:00.000+02:00",
        "2019-04-04T00:00:00.000+02:00",
        "2019-04-05T00:00:00.000+02:00",
        "2019-04-06T00:00:00.000+02:00",
        "2019-04-07T00:00:00.000+02:00",
    ]);

    await setScale("month");
    expect(getGridInfo()).toEqual([
        "2019-03-01T00:00:00.000+01:00",
        "2019-03-02T00:00:00.000+01:00",
        "2019-03-03T00:00:00.000+01:00",
        "2019-03-04T00:00:00.000+01:00",
        "2019-03-05T00:00:00.000+01:00",
        "2019-03-06T00:00:00.000+01:00",
        "2019-03-07T00:00:00.000+01:00",
        "2019-03-08T00:00:00.000+01:00",
        "2019-03-09T00:00:00.000+01:00",
        "2019-03-10T00:00:00.000+01:00",
        "2019-03-11T00:00:00.000+01:00",
        "2019-03-12T00:00:00.000+01:00",
        "2019-03-13T00:00:00.000+01:00",
        "2019-03-14T00:00:00.000+01:00",
        "2019-03-15T00:00:00.000+01:00",
        "2019-03-16T00:00:00.000+01:00",
        "2019-03-17T00:00:00.000+01:00",
        "2019-03-18T00:00:00.000+01:00",
        "2019-03-19T00:00:00.000+01:00",
        "2019-03-20T00:00:00.000+01:00",
        "2019-03-21T00:00:00.000+01:00",
        "2019-03-22T00:00:00.000+01:00",
        "2019-03-23T00:00:00.000+01:00",
        "2019-03-24T00:00:00.000+01:00",
        "2019-03-25T00:00:00.000+01:00",
        "2019-03-26T00:00:00.000+01:00",
        "2019-03-27T00:00:00.000+01:00",
        "2019-03-28T00:00:00.000+01:00",
        "2019-03-29T00:00:00.000+01:00",
        "2019-03-30T00:00:00.000+01:00",
        "2019-03-31T00:00:00.000+01:00",
        "2019-04-01T00:00:00.000+02:00",
    ]);

    await setScale("year");
    expect(getGridInfo()).toEqual([
        "2019-01-01T00:00:00.000+01:00",
        "2019-02-01T00:00:00.000+01:00",
        "2019-03-01T00:00:00.000+01:00",
        "2019-04-01T00:00:00.000+02:00",
        "2019-05-01T00:00:00.000+02:00",
        "2019-06-01T00:00:00.000+02:00",
        "2019-07-01T00:00:00.000+02:00",
        "2019-08-01T00:00:00.000+02:00",
        "2019-09-01T00:00:00.000+02:00",
        "2019-10-01T00:00:00.000+02:00",
        "2019-11-01T00:00:00.000+01:00",
        "2019-12-01T00:00:00.000+01:00",
        "2020-01-01T00:00:00.000+01:00",
    ]);
});

test("date grid and dst summerToWinter (1 cell part)", async () => {
    let renderer;
    patchWithCleanup(GanttRenderer.prototype, {
        setup() {
            super.setup(...arguments);
            renderer = this;
        },
    });

    patchTimeZone("Europe/Brussels");
    Tasks._records = [];

    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" default_scale="day" precision="{'day':'hour:full', 'week':'day:full', 'month':'day:full', 'year':'month:full' }"/>`,
        domain: [["id", "=", 8]],
        context: {
            initialDate: `${DST_DATES.summerToWinter.before} 08:00:00`,
        },
    });

    function getGridInfo() {
        return renderer.dateGridColumns.map((d) => d.toString());
    }
    expect(getGridInfo()).toEqual([
        "2019-10-26T00:00:00.000+02:00",
        "2019-10-26T01:00:00.000+02:00",
        "2019-10-26T02:00:00.000+02:00",
        "2019-10-26T03:00:00.000+02:00",
        "2019-10-26T04:00:00.000+02:00",
        "2019-10-26T05:00:00.000+02:00",
        "2019-10-26T06:00:00.000+02:00",
        "2019-10-26T07:00:00.000+02:00",
        "2019-10-26T08:00:00.000+02:00",
        "2019-10-26T09:00:00.000+02:00",
        "2019-10-26T10:00:00.000+02:00",
        "2019-10-26T11:00:00.000+02:00",
        "2019-10-26T12:00:00.000+02:00",
        "2019-10-26T13:00:00.000+02:00",
        "2019-10-26T14:00:00.000+02:00",
        "2019-10-26T15:00:00.000+02:00",
        "2019-10-26T16:00:00.000+02:00",
        "2019-10-26T17:00:00.000+02:00",
        "2019-10-26T18:00:00.000+02:00",
        "2019-10-26T19:00:00.000+02:00",
        "2019-10-26T20:00:00.000+02:00",
        "2019-10-26T21:00:00.000+02:00",
        "2019-10-26T22:00:00.000+02:00",
        "2019-10-26T23:00:00.000+02:00",
        "2019-10-27T00:00:00.000+02:00",
    ]);

    await contains(SELECTORS.nextButton).click();
    expect(getGridInfo()).toEqual([
        "2019-10-27T00:00:00.000+02:00",
        "2019-10-27T01:00:00.000+02:00",
        "2019-10-27T02:00:00.000+02:00",
        "2019-10-27T02:00:00.000+01:00",
        "2019-10-27T03:00:00.000+01:00",
        "2019-10-27T04:00:00.000+01:00",
        "2019-10-27T05:00:00.000+01:00",
        "2019-10-27T06:00:00.000+01:00",
        "2019-10-27T07:00:00.000+01:00",
        "2019-10-27T08:00:00.000+01:00",
        "2019-10-27T09:00:00.000+01:00",
        "2019-10-27T10:00:00.000+01:00",
        "2019-10-27T11:00:00.000+01:00",
        "2019-10-27T12:00:00.000+01:00",
        "2019-10-27T13:00:00.000+01:00",
        "2019-10-27T14:00:00.000+01:00",
        "2019-10-27T15:00:00.000+01:00",
        "2019-10-27T16:00:00.000+01:00",
        "2019-10-27T17:00:00.000+01:00",
        "2019-10-27T18:00:00.000+01:00",
        "2019-10-27T19:00:00.000+01:00",
        "2019-10-27T20:00:00.000+01:00",
        "2019-10-27T21:00:00.000+01:00",
        "2019-10-27T22:00:00.000+01:00",
        "2019-10-27T23:00:00.000+01:00",
        "2019-10-28T00:00:00.000+01:00",
    ]);

    await setScale("week");
    expect(getGridInfo()).toEqual([
        "2019-10-27T00:00:00.000+02:00",
        "2019-10-28T00:00:00.000+01:00",
        "2019-10-29T00:00:00.000+01:00",
        "2019-10-30T00:00:00.000+01:00",
        "2019-10-31T00:00:00.000+01:00",
        "2019-11-01T00:00:00.000+01:00",
        "2019-11-02T00:00:00.000+01:00",
        "2019-11-03T00:00:00.000+01:00",
    ]);

    await setScale("month");
    expect(getGridInfo()).toEqual([
        "2019-10-01T00:00:00.000+02:00",
        "2019-10-02T00:00:00.000+02:00",
        "2019-10-03T00:00:00.000+02:00",
        "2019-10-04T00:00:00.000+02:00",
        "2019-10-05T00:00:00.000+02:00",
        "2019-10-06T00:00:00.000+02:00",
        "2019-10-07T00:00:00.000+02:00",
        "2019-10-08T00:00:00.000+02:00",
        "2019-10-09T00:00:00.000+02:00",
        "2019-10-10T00:00:00.000+02:00",
        "2019-10-11T00:00:00.000+02:00",
        "2019-10-12T00:00:00.000+02:00",
        "2019-10-13T00:00:00.000+02:00",
        "2019-10-14T00:00:00.000+02:00",
        "2019-10-15T00:00:00.000+02:00",
        "2019-10-16T00:00:00.000+02:00",
        "2019-10-17T00:00:00.000+02:00",
        "2019-10-18T00:00:00.000+02:00",
        "2019-10-19T00:00:00.000+02:00",
        "2019-10-20T00:00:00.000+02:00",
        "2019-10-21T00:00:00.000+02:00",
        "2019-10-22T00:00:00.000+02:00",
        "2019-10-23T00:00:00.000+02:00",
        "2019-10-24T00:00:00.000+02:00",
        "2019-10-25T00:00:00.000+02:00",
        "2019-10-26T00:00:00.000+02:00",
        "2019-10-27T00:00:00.000+02:00",
        "2019-10-28T00:00:00.000+01:00",
        "2019-10-29T00:00:00.000+01:00",
        "2019-10-30T00:00:00.000+01:00",
        "2019-10-31T00:00:00.000+01:00",
        "2019-11-01T00:00:00.000+01:00",
    ]);

    await setScale("year");
    expect(getGridInfo()).toEqual([
        "2019-01-01T00:00:00.000+01:00",
        "2019-02-01T00:00:00.000+01:00",
        "2019-03-01T00:00:00.000+01:00",
        "2019-04-01T00:00:00.000+02:00",
        "2019-05-01T00:00:00.000+02:00",
        "2019-06-01T00:00:00.000+02:00",
        "2019-07-01T00:00:00.000+02:00",
        "2019-08-01T00:00:00.000+02:00",
        "2019-09-01T00:00:00.000+02:00",
        "2019-10-01T00:00:00.000+02:00",
        "2019-11-01T00:00:00.000+01:00",
        "2019-12-01T00:00:00.000+01:00",
        "2020-01-01T00:00:00.000+01:00",
    ]);
});

test("date grid and dst winterToSummer (2 cell part)", async () => {
    let renderer;
    patchWithCleanup(GanttRenderer.prototype, {
        setup() {
            super.setup(...arguments);
            renderer = this;
        },
    });

    patchTimeZone("Europe/Brussels");
    Tasks._records = [];

    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" default_scale="day" precision="{'day':'hour:half', 'week':'day:half', 'month':'day:half'}"/>`,
        domain: [["id", "=", 8]],
        context: {
            initialDate: `${DST_DATES.winterToSummer.before} 08:00:00`,
        },
    });

    function getGridInfo() {
        return renderer.dateGridColumns.map((d) => d.toString());
    }
    expect(getGridInfo()).toEqual([
        "2019-03-30T00:00:00.000+01:00",
        "2019-03-30T00:30:00.000+01:00",
        "2019-03-30T01:00:00.000+01:00",
        "2019-03-30T01:30:00.000+01:00",
        "2019-03-30T02:00:00.000+01:00",
        "2019-03-30T02:30:00.000+01:00",
        "2019-03-30T03:00:00.000+01:00",
        "2019-03-30T03:30:00.000+01:00",
        "2019-03-30T04:00:00.000+01:00",
        "2019-03-30T04:30:00.000+01:00",
        "2019-03-30T05:00:00.000+01:00",
        "2019-03-30T05:30:00.000+01:00",
        "2019-03-30T06:00:00.000+01:00",
        "2019-03-30T06:30:00.000+01:00",
        "2019-03-30T07:00:00.000+01:00",
        "2019-03-30T07:30:00.000+01:00",
        "2019-03-30T08:00:00.000+01:00",
        "2019-03-30T08:30:00.000+01:00",
        "2019-03-30T09:00:00.000+01:00",
        "2019-03-30T09:30:00.000+01:00",
        "2019-03-30T10:00:00.000+01:00",
        "2019-03-30T10:30:00.000+01:00",
        "2019-03-30T11:00:00.000+01:00",
        "2019-03-30T11:30:00.000+01:00",
        "2019-03-30T12:00:00.000+01:00",
        "2019-03-30T12:30:00.000+01:00",
        "2019-03-30T13:00:00.000+01:00",
        "2019-03-30T13:30:00.000+01:00",
        "2019-03-30T14:00:00.000+01:00",
        "2019-03-30T14:30:00.000+01:00",
        "2019-03-30T15:00:00.000+01:00",
        "2019-03-30T15:30:00.000+01:00",
        "2019-03-30T16:00:00.000+01:00",
        "2019-03-30T16:30:00.000+01:00",
        "2019-03-30T17:00:00.000+01:00",
        "2019-03-30T17:30:00.000+01:00",
        "2019-03-30T18:00:00.000+01:00",
        "2019-03-30T18:30:00.000+01:00",
        "2019-03-30T19:00:00.000+01:00",
        "2019-03-30T19:30:00.000+01:00",
        "2019-03-30T20:00:00.000+01:00",
        "2019-03-30T20:30:00.000+01:00",
        "2019-03-30T21:00:00.000+01:00",
        "2019-03-30T21:30:00.000+01:00",
        "2019-03-30T22:00:00.000+01:00",
        "2019-03-30T22:30:00.000+01:00",
        "2019-03-30T23:00:00.000+01:00",
        "2019-03-30T23:30:00.000+01:00",
        "2019-03-31T00:00:00.000+01:00",
    ]);

    await contains(SELECTORS.nextButton).click();
    expect(getGridInfo()).toEqual([
        "2019-03-31T00:00:00.000+01:00",
        "2019-03-31T00:30:00.000+01:00",
        "2019-03-31T01:00:00.000+01:00",
        "2019-03-31T01:30:00.000+01:00",
        "2019-03-31T03:00:00.000+02:00",
        "2019-03-31T03:30:00.000+02:00",
        "2019-03-31T04:00:00.000+02:00",
        "2019-03-31T04:30:00.000+02:00",
        "2019-03-31T05:00:00.000+02:00",
        "2019-03-31T05:30:00.000+02:00",
        "2019-03-31T06:00:00.000+02:00",
        "2019-03-31T06:30:00.000+02:00",
        "2019-03-31T07:00:00.000+02:00",
        "2019-03-31T07:30:00.000+02:00",
        "2019-03-31T08:00:00.000+02:00",
        "2019-03-31T08:30:00.000+02:00",
        "2019-03-31T09:00:00.000+02:00",
        "2019-03-31T09:30:00.000+02:00",
        "2019-03-31T10:00:00.000+02:00",
        "2019-03-31T10:30:00.000+02:00",
        "2019-03-31T11:00:00.000+02:00",
        "2019-03-31T11:30:00.000+02:00",
        "2019-03-31T12:00:00.000+02:00",
        "2019-03-31T12:30:00.000+02:00",
        "2019-03-31T13:00:00.000+02:00",
        "2019-03-31T13:30:00.000+02:00",
        "2019-03-31T14:00:00.000+02:00",
        "2019-03-31T14:30:00.000+02:00",
        "2019-03-31T15:00:00.000+02:00",
        "2019-03-31T15:30:00.000+02:00",
        "2019-03-31T16:00:00.000+02:00",
        "2019-03-31T16:30:00.000+02:00",
        "2019-03-31T17:00:00.000+02:00",
        "2019-03-31T17:30:00.000+02:00",
        "2019-03-31T18:00:00.000+02:00",
        "2019-03-31T18:30:00.000+02:00",
        "2019-03-31T19:00:00.000+02:00",
        "2019-03-31T19:30:00.000+02:00",
        "2019-03-31T20:00:00.000+02:00",
        "2019-03-31T20:30:00.000+02:00",
        "2019-03-31T21:00:00.000+02:00",
        "2019-03-31T21:30:00.000+02:00",
        "2019-03-31T22:00:00.000+02:00",
        "2019-03-31T22:30:00.000+02:00",
        "2019-03-31T23:00:00.000+02:00",
        "2019-03-31T23:30:00.000+02:00",
        "2019-04-01T00:00:00.000+02:00",
    ]);

    await setScale("week");
    expect(getGridInfo()).toEqual([
        "2019-03-31T00:00:00.000+01:00",
        "2019-03-31T12:00:00.000+02:00",
        "2019-04-01T00:00:00.000+02:00",
        "2019-04-01T12:00:00.000+02:00",
        "2019-04-02T00:00:00.000+02:00",
        "2019-04-02T12:00:00.000+02:00",
        "2019-04-03T00:00:00.000+02:00",
        "2019-04-03T12:00:00.000+02:00",
        "2019-04-04T00:00:00.000+02:00",
        "2019-04-04T12:00:00.000+02:00",
        "2019-04-05T00:00:00.000+02:00",
        "2019-04-05T12:00:00.000+02:00",
        "2019-04-06T00:00:00.000+02:00",
        "2019-04-06T12:00:00.000+02:00",
        "2019-04-07T00:00:00.000+02:00",
    ]);

    await setScale("month");
    expect(getGridInfo()).toEqual([
        "2019-03-01T00:00:00.000+01:00",
        "2019-03-01T12:00:00.000+01:00",
        "2019-03-02T00:00:00.000+01:00",
        "2019-03-02T12:00:00.000+01:00",
        "2019-03-03T00:00:00.000+01:00",
        "2019-03-03T12:00:00.000+01:00",
        "2019-03-04T00:00:00.000+01:00",
        "2019-03-04T12:00:00.000+01:00",
        "2019-03-05T00:00:00.000+01:00",
        "2019-03-05T12:00:00.000+01:00",
        "2019-03-06T00:00:00.000+01:00",
        "2019-03-06T12:00:00.000+01:00",
        "2019-03-07T00:00:00.000+01:00",
        "2019-03-07T12:00:00.000+01:00",
        "2019-03-08T00:00:00.000+01:00",
        "2019-03-08T12:00:00.000+01:00",
        "2019-03-09T00:00:00.000+01:00",
        "2019-03-09T12:00:00.000+01:00",
        "2019-03-10T00:00:00.000+01:00",
        "2019-03-10T12:00:00.000+01:00",
        "2019-03-11T00:00:00.000+01:00",
        "2019-03-11T12:00:00.000+01:00",
        "2019-03-12T00:00:00.000+01:00",
        "2019-03-12T12:00:00.000+01:00",
        "2019-03-13T00:00:00.000+01:00",
        "2019-03-13T12:00:00.000+01:00",
        "2019-03-14T00:00:00.000+01:00",
        "2019-03-14T12:00:00.000+01:00",
        "2019-03-15T00:00:00.000+01:00",
        "2019-03-15T12:00:00.000+01:00",
        "2019-03-16T00:00:00.000+01:00",
        "2019-03-16T12:00:00.000+01:00",
        "2019-03-17T00:00:00.000+01:00",
        "2019-03-17T12:00:00.000+01:00",
        "2019-03-18T00:00:00.000+01:00",
        "2019-03-18T12:00:00.000+01:00",
        "2019-03-19T00:00:00.000+01:00",
        "2019-03-19T12:00:00.000+01:00",
        "2019-03-20T00:00:00.000+01:00",
        "2019-03-20T12:00:00.000+01:00",
        "2019-03-21T00:00:00.000+01:00",
        "2019-03-21T12:00:00.000+01:00",
        "2019-03-22T00:00:00.000+01:00",
        "2019-03-22T12:00:00.000+01:00",
        "2019-03-23T00:00:00.000+01:00",
        "2019-03-23T12:00:00.000+01:00",
        "2019-03-24T00:00:00.000+01:00",
        "2019-03-24T12:00:00.000+01:00",
        "2019-03-25T00:00:00.000+01:00",
        "2019-03-25T12:00:00.000+01:00",
        "2019-03-26T00:00:00.000+01:00",
        "2019-03-26T12:00:00.000+01:00",
        "2019-03-27T00:00:00.000+01:00",
        "2019-03-27T12:00:00.000+01:00",
        "2019-03-28T00:00:00.000+01:00",
        "2019-03-28T12:00:00.000+01:00",
        "2019-03-29T00:00:00.000+01:00",
        "2019-03-29T12:00:00.000+01:00",
        "2019-03-30T00:00:00.000+01:00",
        "2019-03-30T12:00:00.000+01:00",
        "2019-03-31T00:00:00.000+01:00",
        "2019-03-31T12:00:00.000+02:00",
        "2019-04-01T00:00:00.000+02:00",
    ]);
});

test("date grid and dst summerToWinter (2 cell part)", async () => {
    let renderer;
    patchWithCleanup(GanttRenderer.prototype, {
        setup() {
            super.setup(...arguments);
            renderer = this;
        },
    });

    patchTimeZone("Europe/Brussels");
    Tasks._records = [];

    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" default_scale="day" precision="{'day':'hour:half', 'week':'day:half', 'month':'day:half'}"/>`,
        context: {
            initialDate: `${DST_DATES.summerToWinter.before} 08:00:00`,
        },
    });

    function getGridInfo() {
        return renderer.dateGridColumns.map((d) => d.toString());
    }
    expect(getGridInfo()).toEqual([
        "2019-10-26T00:00:00.000+02:00",
        "2019-10-26T00:30:00.000+02:00",
        "2019-10-26T01:00:00.000+02:00",
        "2019-10-26T01:30:00.000+02:00",
        "2019-10-26T02:00:00.000+02:00",
        "2019-10-26T02:30:00.000+02:00",
        "2019-10-26T03:00:00.000+02:00",
        "2019-10-26T03:30:00.000+02:00",
        "2019-10-26T04:00:00.000+02:00",
        "2019-10-26T04:30:00.000+02:00",
        "2019-10-26T05:00:00.000+02:00",
        "2019-10-26T05:30:00.000+02:00",
        "2019-10-26T06:00:00.000+02:00",
        "2019-10-26T06:30:00.000+02:00",
        "2019-10-26T07:00:00.000+02:00",
        "2019-10-26T07:30:00.000+02:00",
        "2019-10-26T08:00:00.000+02:00",
        "2019-10-26T08:30:00.000+02:00",
        "2019-10-26T09:00:00.000+02:00",
        "2019-10-26T09:30:00.000+02:00",
        "2019-10-26T10:00:00.000+02:00",
        "2019-10-26T10:30:00.000+02:00",
        "2019-10-26T11:00:00.000+02:00",
        "2019-10-26T11:30:00.000+02:00",
        "2019-10-26T12:00:00.000+02:00",
        "2019-10-26T12:30:00.000+02:00",
        "2019-10-26T13:00:00.000+02:00",
        "2019-10-26T13:30:00.000+02:00",
        "2019-10-26T14:00:00.000+02:00",
        "2019-10-26T14:30:00.000+02:00",
        "2019-10-26T15:00:00.000+02:00",
        "2019-10-26T15:30:00.000+02:00",
        "2019-10-26T16:00:00.000+02:00",
        "2019-10-26T16:30:00.000+02:00",
        "2019-10-26T17:00:00.000+02:00",
        "2019-10-26T17:30:00.000+02:00",
        "2019-10-26T18:00:00.000+02:00",
        "2019-10-26T18:30:00.000+02:00",
        "2019-10-26T19:00:00.000+02:00",
        "2019-10-26T19:30:00.000+02:00",
        "2019-10-26T20:00:00.000+02:00",
        "2019-10-26T20:30:00.000+02:00",
        "2019-10-26T21:00:00.000+02:00",
        "2019-10-26T21:30:00.000+02:00",
        "2019-10-26T22:00:00.000+02:00",
        "2019-10-26T22:30:00.000+02:00",
        "2019-10-26T23:00:00.000+02:00",
        "2019-10-26T23:30:00.000+02:00",
        "2019-10-27T00:00:00.000+02:00",
    ]);

    await contains(SELECTORS.nextButton).click();
    expect(getGridInfo()).toEqual([
        "2019-10-27T00:00:00.000+02:00",
        "2019-10-27T00:30:00.000+02:00",
        "2019-10-27T01:00:00.000+02:00",
        "2019-10-27T01:30:00.000+02:00",
        "2019-10-27T02:00:00.000+02:00",
        "2019-10-27T02:30:00.000+02:00",
        "2019-10-27T02:00:00.000+01:00",
        "2019-10-27T02:30:00.000+01:00",
        "2019-10-27T03:00:00.000+01:00",
        "2019-10-27T03:30:00.000+01:00",
        "2019-10-27T04:00:00.000+01:00",
        "2019-10-27T04:30:00.000+01:00",
        "2019-10-27T05:00:00.000+01:00",
        "2019-10-27T05:30:00.000+01:00",
        "2019-10-27T06:00:00.000+01:00",
        "2019-10-27T06:30:00.000+01:00",
        "2019-10-27T07:00:00.000+01:00",
        "2019-10-27T07:30:00.000+01:00",
        "2019-10-27T08:00:00.000+01:00",
        "2019-10-27T08:30:00.000+01:00",
        "2019-10-27T09:00:00.000+01:00",
        "2019-10-27T09:30:00.000+01:00",
        "2019-10-27T10:00:00.000+01:00",
        "2019-10-27T10:30:00.000+01:00",
        "2019-10-27T11:00:00.000+01:00",
        "2019-10-27T11:30:00.000+01:00",
        "2019-10-27T12:00:00.000+01:00",
        "2019-10-27T12:30:00.000+01:00",
        "2019-10-27T13:00:00.000+01:00",
        "2019-10-27T13:30:00.000+01:00",
        "2019-10-27T14:00:00.000+01:00",
        "2019-10-27T14:30:00.000+01:00",
        "2019-10-27T15:00:00.000+01:00",
        "2019-10-27T15:30:00.000+01:00",
        "2019-10-27T16:00:00.000+01:00",
        "2019-10-27T16:30:00.000+01:00",
        "2019-10-27T17:00:00.000+01:00",
        "2019-10-27T17:30:00.000+01:00",
        "2019-10-27T18:00:00.000+01:00",
        "2019-10-27T18:30:00.000+01:00",
        "2019-10-27T19:00:00.000+01:00",
        "2019-10-27T19:30:00.000+01:00",
        "2019-10-27T20:00:00.000+01:00",
        "2019-10-27T20:30:00.000+01:00",
        "2019-10-27T21:00:00.000+01:00",
        "2019-10-27T21:30:00.000+01:00",
        "2019-10-27T22:00:00.000+01:00",
        "2019-10-27T22:30:00.000+01:00",
        "2019-10-27T23:00:00.000+01:00",
        "2019-10-27T23:30:00.000+01:00",
        "2019-10-28T00:00:00.000+01:00",
    ]);

    await setScale("week");
    expect(getGridInfo()).toEqual([
        "2019-10-27T00:00:00.000+02:00",
        "2019-10-27T12:00:00.000+01:00",
        "2019-10-28T00:00:00.000+01:00",
        "2019-10-28T12:00:00.000+01:00",
        "2019-10-29T00:00:00.000+01:00",
        "2019-10-29T12:00:00.000+01:00",
        "2019-10-30T00:00:00.000+01:00",
        "2019-10-30T12:00:00.000+01:00",
        "2019-10-31T00:00:00.000+01:00",
        "2019-10-31T12:00:00.000+01:00",
        "2019-11-01T00:00:00.000+01:00",
        "2019-11-01T12:00:00.000+01:00",
        "2019-11-02T00:00:00.000+01:00",
        "2019-11-02T12:00:00.000+01:00",
        "2019-11-03T00:00:00.000+01:00",
    ]);

    await setScale("month");
    expect(getGridInfo()).toEqual([
        "2019-10-01T00:00:00.000+02:00",
        "2019-10-01T12:00:00.000+02:00",
        "2019-10-02T00:00:00.000+02:00",
        "2019-10-02T12:00:00.000+02:00",
        "2019-10-03T00:00:00.000+02:00",
        "2019-10-03T12:00:00.000+02:00",
        "2019-10-04T00:00:00.000+02:00",
        "2019-10-04T12:00:00.000+02:00",
        "2019-10-05T00:00:00.000+02:00",
        "2019-10-05T12:00:00.000+02:00",
        "2019-10-06T00:00:00.000+02:00",
        "2019-10-06T12:00:00.000+02:00",
        "2019-10-07T00:00:00.000+02:00",
        "2019-10-07T12:00:00.000+02:00",
        "2019-10-08T00:00:00.000+02:00",
        "2019-10-08T12:00:00.000+02:00",
        "2019-10-09T00:00:00.000+02:00",
        "2019-10-09T12:00:00.000+02:00",
        "2019-10-10T00:00:00.000+02:00",
        "2019-10-10T12:00:00.000+02:00",
        "2019-10-11T00:00:00.000+02:00",
        "2019-10-11T12:00:00.000+02:00",
        "2019-10-12T00:00:00.000+02:00",
        "2019-10-12T12:00:00.000+02:00",
        "2019-10-13T00:00:00.000+02:00",
        "2019-10-13T12:00:00.000+02:00",
        "2019-10-14T00:00:00.000+02:00",
        "2019-10-14T12:00:00.000+02:00",
        "2019-10-15T00:00:00.000+02:00",
        "2019-10-15T12:00:00.000+02:00",
        "2019-10-16T00:00:00.000+02:00",
        "2019-10-16T12:00:00.000+02:00",
        "2019-10-17T00:00:00.000+02:00",
        "2019-10-17T12:00:00.000+02:00",
        "2019-10-18T00:00:00.000+02:00",
        "2019-10-18T12:00:00.000+02:00",
        "2019-10-19T00:00:00.000+02:00",
        "2019-10-19T12:00:00.000+02:00",
        "2019-10-20T00:00:00.000+02:00",
        "2019-10-20T12:00:00.000+02:00",
        "2019-10-21T00:00:00.000+02:00",
        "2019-10-21T12:00:00.000+02:00",
        "2019-10-22T00:00:00.000+02:00",
        "2019-10-22T12:00:00.000+02:00",
        "2019-10-23T00:00:00.000+02:00",
        "2019-10-23T12:00:00.000+02:00",
        "2019-10-24T00:00:00.000+02:00",
        "2019-10-24T12:00:00.000+02:00",
        "2019-10-25T00:00:00.000+02:00",
        "2019-10-25T12:00:00.000+02:00",
        "2019-10-26T00:00:00.000+02:00",
        "2019-10-26T12:00:00.000+02:00",
        "2019-10-27T00:00:00.000+02:00",
        "2019-10-27T12:00:00.000+01:00",
        "2019-10-28T00:00:00.000+01:00",
        "2019-10-28T12:00:00.000+01:00",
        "2019-10-29T00:00:00.000+01:00",
        "2019-10-29T12:00:00.000+01:00",
        "2019-10-30T00:00:00.000+01:00",
        "2019-10-30T12:00:00.000+01:00",
        "2019-10-31T00:00:00.000+01:00",
        "2019-10-31T12:00:00.000+01:00",
        "2019-11-01T00:00:00.000+01:00",
    ]);
});

test("groups_limit attribute (no groupBy)", async () => {
    onRpc("*", (_, { method, kwargs }) => {
        expect.step(method);
        if (kwargs.limit) {
            expect.step(`with limit ${kwargs.limit}`);
        }
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" groups_limit="2"/>`,
    });
    expect(".o_gantt_view .o_control_panel .o_pager").toHaveCount(0); // only one group here!
    expect(["get_views", "get_gantt_data", "with limit 2"]).toVerifySteps();
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
    ]);
});

test("groups_limit attribute (one groupBy)", async () => {
    onRpc("*", (_, { method, kwargs }) => {
        expect.step(method);
        if (kwargs.limit) {
            expect.step(`with limit ${kwargs.limit}`);
            expect.step(`with offset ${kwargs.offset}`);
        }
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" groups_limit="2"/>`,
        groupBy: ["stage_id"],
    });
    expect(".o_gantt_view .o_control_panel .o_pager").toHaveCount(1);
    expect(".o_pager_value").toHaveText("1-2");
    expect(".o_pager_limit").toHaveText("4");
    let rows = getGridContent().rows;
    expect(rows).toEqual([
        {
            pills: [
                {
                    colSpan: "01 -> 04 (1/2)",
                    level: 0,
                    title: "Task 5",
                },
            ],
            title: "todo",
        },
        {
            pills: [
                {
                    colSpan: "01 -> 31",
                    level: 0,
                    title: "Task 1",
                },
                {
                    colSpan: "20 (1/2) -> 20",
                    level: 1,
                    title: "Task 7",
                },
            ],
            title: "in_progress",
        },
    ]);
    expect(["get_views", "get_gantt_data", "with limit 2", "with offset 0"]).toVerifySteps();

    await pagerNext();
    expect(".o_pager_value").toHaveText("3-4");
    expect(".o_pager_limit").toHaveText("4");
    rows = getGridContent().rows;
    expect(rows).toEqual([
        {
            pills: [
                {
                    colSpan: "17 (1/2) -> 22 (1/2)",
                    level: 0,
                    title: "Task 2",
                },
            ],
            title: "done",
        },
        {
            pills: [
                {
                    colSpan: "20 -> 20 (1/2)",
                    level: 0,
                    title: "Task 4",
                },
                {
                    colSpan: "27 -> 31",
                    level: 0,
                    title: "Task 3",
                },
            ],
            title: "cancel",
        },
    ]);
    expect(["get_gantt_data", "with limit 2", "with offset 2"]).toVerifySteps();
});

test("groups_limit attribute (two groupBys)", async () => {
    onRpc("*", (_, { method, kwargs }) => {
        expect.step(method);
        if (kwargs.limit) {
            expect.step(`with limit ${kwargs.limit}`);
            expect.step(`with offset ${kwargs.offset}`);
        }
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" groups_limit="2"/>`,
        groupBy: ["stage_id", "project_id"],
    });
    expect(".o_gantt_view .o_control_panel .o_pager").toHaveCount(1);
    expect(".o_pager_value").toHaveText("1-2");
    expect(".o_pager_limit").toHaveText("5");
    let rows = getGridContent().rows;
    expect(rows).toEqual([
        {
            isGroup: true,
            pills: [
                {
                    colSpan: "01 -> 04 (1/2)",
                    title: "1",
                },
            ],
            title: "todo",
        },
        {
            pills: [
                {
                    colSpan: "01 -> 04 (1/2)",
                    level: 0,
                    title: "Task 5",
                },
            ],
            title: "Project 2",
        },
        {
            isGroup: true,
            pills: [
                {
                    colSpan: "01 -> 31",
                    title: "1",
                },
            ],
            title: "in_progress",
        },
        {
            pills: [
                {
                    colSpan: "01 -> 31",
                    level: 0,
                    title: "Task 1",
                },
            ],
            title: "Project 1",
        },
    ]);
    expect(["get_views", "get_gantt_data", "with limit 2", "with offset 0"]).toVerifySteps();

    await pagerNext();
    expect(".o_pager_value").toHaveText("3-4");
    expect(".o_pager_limit").toHaveText("5");
    rows = getGridContent().rows;
    expect(rows).toEqual([
        {
            isGroup: true,
            pills: [
                {
                    colSpan: "20 (1/2) -> 20",
                    title: "1",
                },
            ],
            title: "in_progress",
        },
        {
            pills: [
                {
                    colSpan: "20 (1/2) -> 20",
                    level: 0,
                    title: "Task 7",
                },
            ],
            title: "Project 2",
        },
        {
            isGroup: true,
            pills: [
                {
                    colSpan: "17 (1/2) -> 22 (1/2)",
                    title: "1",
                },
            ],
            title: "done",
        },
        {
            pills: [
                {
                    colSpan: "17 (1/2) -> 22 (1/2)",
                    level: 0,
                    title: "Task 2",
                },
            ],
            title: "Project 1",
        },
    ]);
    expect(["get_gantt_data", "with limit 2", "with offset 2"]).toVerifySteps();

    await pagerNext();
    expect(".o_pager_value").toHaveText("5-5");
    expect(".o_pager_limit").toHaveText("5");
    rows = getGridContent().rows;
    expect(rows).toEqual([
        {
            isGroup: true,
            pills: [
                {
                    colSpan: "20 -> 20 (1/2)",
                    title: "1",
                },
                {
                    colSpan: "27 -> 31",
                    title: "1",
                },
            ],
            title: "cancel",
        },
        {
            pills: [
                {
                    colSpan: "20 -> 20 (1/2)",
                    level: 0,
                    title: "Task 4",
                },
                {
                    colSpan: "27 -> 31",
                    level: 0,
                    title: "Task 3",
                },
            ],
            title: "Project 1",
        },
    ]);
    expect(["get_gantt_data", "with limit 2", "with offset 4"]).toVerifySteps();
});

test("groups_limit attribute in sample mode (no groupBy)", async () => {
    onRpc("*", (_, { method, kwargs }) => {
        expect.step(method);
        if (kwargs.limit) {
            expect.step(`with limit ${kwargs.limit}`);
        }
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" groups_limit="2" sample="1"/>`,
        domain: Domain.FALSE.toList(),
    });
    expect(".o_gantt_view .o_control_panel .o_pager").toHaveCount(0); // only one group here!
    expect(["get_views", "get_gantt_data", "with limit 2"]).toVerifySteps();
});

test("groups_limit attribute in sample mode (one groupBy)", async () => {
    onRpc("*", (_, { method, kwargs }) => {
        expect.step(method);
        if (kwargs.limit) {
            expect.step(`with limit ${kwargs.limit}`);
            expect.step(`with offset ${kwargs.offset}`);
        }
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" groups_limit="2" sample="1"/>`,
        domain: Domain.FALSE.toList(),
        groupBy: ["stage_id"],
    });
    expect(".o_gantt_view .o_control_panel .o_pager").toHaveCount(1);
    expect(".o_pager_value").toHaveText("1-2");
    expect(".o_pager_limit").toHaveText("2");
    expect(".o_gantt_row_title").toHaveCount(2);
    expect(["get_views", "get_gantt_data", "with limit 2", "with offset 0"]).toVerifySteps();
});

test("groups_limit attribute in sample mode (two groupBys)", async () => {
    onRpc("*", (_, { method, kwargs }) => {
        expect.step(method);
        if (kwargs.limit) {
            expect.step(`with limit ${kwargs.limit}`);
            expect.step(`with offset ${kwargs.offset}`);
        }
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" groups_limit="2" sample="1"/>`,
        domain: Domain.FALSE.toList(),
        groupBy: ["stage_id", "project_id"],
    });
    expect(".o_gantt_view .o_control_panel .o_pager").toHaveCount(1);
    expect(".o_pager_value").toHaveText("1-2");
    expect(".o_pager_limit").toHaveText("2");
    expect(["get_views", "get_gantt_data", "with limit 2", "with offset 0"]).toVerifySteps();
});

test("context in action should not override context added by the gantt view", async () => {
    Tasks._views.form = `
        <form>
            <field name="name"/>
            <field name="user_id"/>
            <field name="start"/>
            <field name="stop"/>
        </form>
    `;
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" default_group_by="user_id" plan="false"/>`,
        context: {
            gantt_date: "2018-11-30",
            gantt_scale: "month",
            default_user_id: false,
        },
    });
    await hoverGridCell(1, 1, { ignoreHoverableClass: true });
    await clickCell(1, 1);
    expect(".modal .o_field_many2one[name=user_id]").toHaveCount(1);
    expect(".modal .o_field_many2one[name=user_id] input").toHaveValue("User 1");
});

test("The date and task should appear even if the pill is planned on 2 days but displayed in one day by the gantt view", async () => {
    patchDate("2024-01-01T08:00:00", +0);
    Tasks._records.push(
        {
            id: 9,
            name: "Task 9",
            allocated_hours: 4,
            start: "2024-01-01 16:00:00",
            stop: "2024-01-02 01:00:00",
        },
        {
            id: 10,
            name: "Task 10",
            allocated_hours: 4,
            start: "2024-01-02 16:00:00",
            stop: "2024-01-03 02:00:00",
        },
        {
            // will be displayed in 2 days
            id: 11,
            name: "Task 11",
            allocated_hours: 4,
            start: "2024-01-03 16:00:00",
            stop: "2024-01-04 03:00:00",
        }
    );
    await mountView({
        type: "gantt",
        resModel: "tasks",
        arch: `<gantt date_start="start"
                          date_stop="stop"
                          pill_label="True"
                          default_scale="week"
                          scales="week"
                          precision="{'week': 'day:full'}"
                    >
                    <field name="allocated_hours"/>
                </gantt>`,
    });
    expect(".o_gantt_pill").toHaveCount(3, { message: "should have 3 pills in the gantt view" });
    expect(queryAllTexts(".o_gantt_pill_title")).toEqual([
        "4:00 PM - 1:00 AM (4h) - Task 9",
        "4:00 PM - 2:00 AM (4h) - Task 10",
        "Task 11",
    ]);
});
