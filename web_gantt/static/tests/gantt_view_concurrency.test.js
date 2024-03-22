import { beforeEach, describe, expect, test } from "@odoo/hoot";
import { Deferred, animationFrame } from "@odoo/hoot-mock";
import { onPatched } from "@odoo/owl";
import {
    contains,
    mountView,
    onRpc,
    patchDate,
    patchWithCleanup,
    toggleMenuItem,
    toggleSearchBarMenu,
} from "@web/../tests/web_test_helpers";

import { GanttRenderer } from "@web_gantt/gantt_renderer";
import { Tasks, defineGanttModels } from "./gantt_mock_models";
import {
    SELECTORS,
    editPill,
    getActiveScale,
    getCellColorProperties,
    getGridContent,
    getPillWrapper,
    resizePill,
    setScale,
} from "./gantt_test_helpers";

defineGanttModels();

describe.current.tags("desktop");

beforeEach(() => {
    patchDate("2018-12-20T08:00:00", +1);
});

test("concurrent scale switches return in inverse order", async () => {
    let model;
    patchWithCleanup(GanttRenderer.prototype, {
        setup() {
            super.setup(...arguments);
            model = this.model;
            onPatched(() => {
                expect.step("patched");
            });
        },
    });

    let firstReloadProm = null;
    let reloadProm = null;
    onRpc("get_gantt_data", () => reloadProm);
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop"/>`,
    });

    let content = getGridContent();
    expect(getActiveScale()).toBe("Month");
    expect(content.range).toBe("December 2018");
    expect(model.data.records).toHaveLength(6);

    // switch to 'week' scale (this rpc will be delayed)
    firstReloadProm = new Deferred();
    reloadProm = firstReloadProm;
    await setScale("week");

    content = getGridContent();
    expect(getActiveScale()).toBe("Month");
    expect(content.range).toBe("December 2018");
    expect(model.data.records).toHaveLength(6);

    // switch to 'year' scale
    reloadProm = null;
    await setScale("year");

    content = getGridContent();
    expect(getActiveScale()).toBe("Year");
    expect(content.range).toBe("2018");
    expect(model.data.records).toHaveLength(7);

    firstReloadProm.resolve();
    await animationFrame();

    content = getGridContent();
    expect(getActiveScale()).toBe("Year");
    expect(content.range).toBe("2018");
    expect(model.data.records).toHaveLength(7);
    expect(["patched"]).toVerifySteps(); // should only be patched once
});

test("concurrent scale switches return with gantt_unavailability", async () => {
    const unavailabilities = [
        [{ start: "2018-12-10 23:00:00", stop: "2018-12-11 23:00:00" }],
        [{ start: "2018-07-30 23:00:00", stop: "2018-08-31 23:00:00" }],
    ];

    let model;
    patchWithCleanup(GanttRenderer.prototype, {
        setup() {
            super.setup(...arguments);
            model = this.model;
            onPatched(() => {
                expect.step("patched");
            });
        },
    });

    let firstReloadProm = null;
    let reloadProm = null;
    onRpc("gantt_unavailability", async ({ args }) => {
        await reloadProm;
        const rows = args[4];
        return rows.map((row) =>
            Object.assign(row, {
                unavailabilities: unavailabilities.shift(),
            })
        );
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop" display_unavailability="true"/>`,
    });

    let content = getGridContent();
    expect(getActiveScale()).toBe("Month");
    expect(content.range).toBe("December 2018");
    expect(model.data.records).toHaveLength(6);
    expect(getCellColorProperties(1, 8)).toEqual([]);
    expect(getCellColorProperties(1, 11)).toEqual(["--Gantt__DayOff-background-color"]);

    // switch to 'week' scale (this rpc will be delayed)
    firstReloadProm = new Deferred();
    reloadProm = firstReloadProm;
    await setScale("week");

    content = getGridContent();
    expect(getActiveScale()).toBe("Month");
    expect(content.range).toBe("December 2018");
    expect(model.data.records).toHaveLength(6);
    expect(getCellColorProperties(1, 8)).toEqual([]);
    expect(getCellColorProperties(1, 11)).toEqual(["--Gantt__DayOff-background-color"]);

    // switch to 'year' scale
    reloadProm = null;
    await setScale("year");

    content = getGridContent();
    expect(getActiveScale()).toBe("Year");
    expect(content.range).toBe("2018");
    expect(model.data.records).toHaveLength(7);
    expect(getCellColorProperties(1, 8)).toEqual(["--Gantt__DayOff-background-color"]);
    expect(getCellColorProperties(1, 11)).toEqual([]);

    firstReloadProm.resolve();
    await animationFrame();

    content = getGridContent();
    expect(getActiveScale()).toBe("Year");
    expect(content.range).toBe("2018");
    expect(model.data.records).toHaveLength(7);
    expect(getCellColorProperties(1, 8)).toEqual(["--Gantt__DayOff-background-color"]);
    expect(getCellColorProperties(1, 11)).toEqual([]);
    expect(["patched"]).toVerifySteps(); // should only be patched once
});

test("concurrent focusDate selections", async () => {
    let reloadProm = null;
    let firstReloadProm = null;
    onRpc("get_gantt_data", () => reloadProm);
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop"/>`,
    });

    let content = getGridContent();
    expect(getActiveScale()).toBe("Month");
    expect(content.range).toBe("December 2018");

    reloadProm = new Deferred();
    firstReloadProm = reloadProm;
    await contains(SELECTORS.nextButton).click();
    reloadProm = null;
    await contains(SELECTORS.nextButton).click();
    firstReloadProm.resolve();
    await animationFrame();
    content = getGridContent();
    expect(content.range).toBe("February 2019");
});

test("concurrent pill resize and groupBy change", async () => {
    let awaitWriteDef = false;
    const writeDef = new Deferred();
    onRpc(({ args, method }) => {
        expect.step(JSON.stringify([method, args]));
        if (method === "write" && awaitWriteDef) {
            return writeDef;
        }
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop"/>`,
        searchViewArch: `
            <search>
                <filter name="group_by" string="Project" domain="[]" context="{ 'group_by': 'project_id' }"/>
            </search>
        `,
        domain: [["id", "in", [2, 5]]],
    });
    expect([
        JSON.stringify(["get_views", []]),
        JSON.stringify(["get_gantt_data", []]),
    ]).toVerifySteps();
    expect(getGridContent().rows).toEqual([
        {
            pills: [
                {
                    colSpan: "01 -> 04 (1/2)",
                    level: 0,
                    title: "Task 5",
                },
                {
                    colSpan: "17 (1/2) -> 22 (1/2)",
                    level: 0,
                    title: "Task 2",
                },
            ],
        },
    ]);

    // resize "Task 2" to 1 cell smaller (-1 day) ; this RPC will be delayed
    awaitWriteDef = true;
    await resizePill(getPillWrapper("Task 2"), "end", -1);
    expect([JSON.stringify(["write", [[2], { stop: "2018-12-21 06:29:59" }]])]).toVerifySteps();

    await toggleSearchBarMenu();
    await toggleMenuItem("Project");
    expect([JSON.stringify(["get_gantt_data", []])]).toVerifySteps();
    expect(getGridContent().rows).toEqual([
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
    ]);

    writeDef.resolve();
    await animationFrame();
    expect([JSON.stringify(["get_gantt_data", []])]).toVerifySteps();
    expect(getGridContent().rows).toEqual([
        {
            pills: [
                {
                    colSpan: "17 (1/2) -> 21 (1/2)",
                    level: 0,
                    title: "Task 2",
                },
            ],
            title: "Project 1",
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
    ]);
});

test("concurrent pill resizes return in inverse order", async () => {
    let awaitWriteDef = false;
    const writeDef = new Deferred();
    onRpc(({ args, method }) => {
        expect.step(JSON.stringify([method, args]));
        if (method === "write" && awaitWriteDef) {
            return writeDef;
        }
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop"/>`,
        domain: [["id", "=", 2]],
    });

    // resize to 1 cell smaller (-1 day) ; this RPC will be delayed
    awaitWriteDef = true;
    await resizePill(getPillWrapper("Task 2"), "end", -1);

    // resize to two cells larger (+2 days) ; no delay
    awaitWriteDef = false;
    await resizePill(getPillWrapper("Task 2"), "end", +2);

    writeDef.resolve();
    await animationFrame();

    expect([
        JSON.stringify(["get_views", []]),
        JSON.stringify(["get_gantt_data", []]),
        JSON.stringify(["write", [[2], { stop: "2018-12-21 06:29:59" }]]),
        JSON.stringify(["get_gantt_data", []]),
        JSON.stringify(["write", [[2], { stop: "2018-12-24 06:29:59" }]]),
        JSON.stringify(["get_gantt_data", []]),
    ]).toVerifySteps();
});

test("concurrent pill resizes and open, dialog show updated number", async () => {
    Tasks._views = {
        form: `
            <form>
                <field name="name"/>
                <field name="start"/>
                <field name="stop"/>
            </form>
        `,
    };

    const def = new Deferred();
    onRpc("write", () => def);
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `<gantt date_start="start" date_stop="stop"/>`,
        domain: [["id", "=", 2]],
    });

    await resizePill(getPillWrapper("Task 2"), "end", +2);
    await editPill("Task 2");

    def.resolve();
    await animationFrame();
    expect(`.modal [name=stop] input`).toHaveValue("12/24/2018 07:29:59");
});
