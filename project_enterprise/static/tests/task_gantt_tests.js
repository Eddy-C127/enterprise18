import { contains } from "@web/../tests/utils";
import {
    getFixture,
    getNodesTextContent,
    patchDate,
    patchWithCleanup,
    click,
    nextTick,
    triggerEvent,
    triggerEvents,
} from "@web/../tests/helpers/utils";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";
import { registry } from "@web/core/registry";
import {
    clickCell,
    dragPill,
    getGridContent,
    hoverGridCell,
    SELECTORS,
} from "@web_gantt/../tests/legacy/helpers";
import { servicesToDefineInGantt } from "@project_enterprise/../tests/task_gantt_dependency_tests";
import { browser } from "@web/core/browser/browser";

const serviceRegistry = registry.category("services");

const ganttViewParams = {
    arch: '<gantt js_class="task_gantt" date_start="start" date_stop="stop"/>',
    resModel: "task",
    type: "gantt",
    groupBy: [],
    async mockRPC(_, args) {
        if (args.method === "get_all_deadlines") {
            return { milestone_id: [], project_id: [] };
        }
    },
};

async function hoverEl(el) {
    const rect = el.getBoundingClientRect();
    const evAttrs = {
        clientX: rect.x,
        clientY: rect.y,
    };
    return triggerEvents(el, null, ["mouseenter", ["mousemove", evAttrs]]);
}

let target;
QUnit.module("Views > TaskGanttView", {
    beforeEach() {
        patchDate(2021, 5, 22, 8, 0, 0);

        setupViewRegistries();

        target = getFixture();

        for (const service of servicesToDefineInGantt) {
            serviceRegistry.add(service, {
                start() {
                    return {
                        formatter: () => {
                            return "";
                        },
                    };
                },
            });
        }

        ganttViewParams.serverData = {
            models: {
                task: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                        start: { string: "Start Date", type: "datetime" },
                        stop: { string: "Start Date", type: "datetime" },
                        time: { string: "Time", type: "float" },
                        user_ids: {
                            string: "Assigned to",
                            type: "many2one",
                            relation: "res.users",
                        },
                        stuff_id: {
                            string: "Stuff",
                            type: "many2one",
                            relation: "stuff",
                        },
                        active: { string: "active", type: "boolean", default: true },
                        project_id: {
                            string: "Project",
                            type: "many2one",
                            relation: "project",
                        },
                        milestone_id: {
                            string: "Milestone",
                            type: "many2one",
                            relation: "milestone",
                        },
                    },
                    records: [
                        {
                            id: 1,
                            name: "Blop",
                            start: "2021-06-14 08:00:00",
                            stop: "2021-06-24 08:00:00",
                            user_ids: 100,
                            project_id: 1,
                            milestone_id: 3,
                        },
                        {
                            id: 2,
                            name: "Yop",
                            start: "2021-06-02 08:00:00",
                            stop: "2021-06-12 08:00:00",
                            user_ids: 101,
                            stuff_id: 1,
                            project_id: 1,
                        },
                    ],
                },
                "res.users": {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                    },
                    records: [
                        { id: 100, name: "Jane Doe" },
                        { id: 101, name: "John Doe" },
                    ],
                },
                stuff: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                    },
                    records: [{ id: 1, name: "Bruce Willis" }],
                },
                project: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                        date: { string: "Date", type: "date" },
                        date_start: { string: "Date Start", type: "date" },
                    },
                    records: [{ id: 1, name: "My Project" }],
                },
                milestone: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                        deadline: { string: "Deadline", type: "date" },
                        is_deadline_exceeded: { string: "Is Deadline Exceeded", type: "boolean" },
                        is_reached: { string: "Is Reached", type: "boolean" },
                        project_id: { string: "Project", type: "many2one", relation: "project" },
                    },
                    records: [
                        {
                            id: 1,
                            name: "Milestone 1",
                            deadline: "2021-06-01",
                            project_id: 1,
                            is_reached: true,
                        },
                        {
                            id: 2,
                            name: "Milestone 2",
                            deadline: "2021-06-12",
                            project_id: 1,
                            is_deadline_exceeded: true,
                        },
                        { id: 3, name: "Milestone 3", deadline: "2021-06-24", project_id: 1 },
                    ],
                },
            },
            views: {
                "task,false,list": '<tree><field name="name"/></tree>',
            },
        };
    },
});

QUnit.test(
    "not user_ids grouped: empty groups are displayed first and user avatar is not displayed",
    async (assert) => {
        await makeView({ ...ganttViewParams, groupBy: ["stuff_id"] });
        assert.deepEqual(
            [...target.querySelectorAll(".o_gantt_row_headers .o_gantt_row_title")].map(
                (el) => el.innerText
            ),
            ["Undefined Stuff", "Bruce Willis"],
            "'Undefined Stuff' should be the first group"
        );
        assert.containsNone(target, ".o_gantt_row_headers .o-mail-Avatar");
    }
);

QUnit.test("Unschedule button is displayed", async (assert) => {
    await makeView({
        ...ganttViewParams,
        async mockRPC(route, args) {
            if (args.method === "action_unschedule_task" && args.model === "project.task") {
                assert.step("unschedule task");
                return {};
            }
            return ganttViewParams.mockRPC(route, args);
        },
    });
    await click(target.querySelector(".o_gantt_pill"));
    const unscheduleButtonClasses = ".btn.btn-sm.btn-secondary.ms-1";
    assert.containsOnce(target, unscheduleButtonClasses);
    assert.strictEqual(target.querySelector(unscheduleButtonClasses).innerText, "Unschedule");
    await click(target, unscheduleButtonClasses);
    assert.verifySteps(["unschedule task"]);
});

QUnit.test("not user_ids grouped: no empty group if no records", async (assert) => {
    // delete the record having no stuff_id
    ganttViewParams.serverData.models.task.records.splice(0, 1);
    await makeView({ ...ganttViewParams, groupBy: ["stuff_id"] });

    assert.deepEqual(
        [...target.querySelectorAll(".o_gantt_row_headers .o_gantt_row_title")].map(
            (el) => el.innerText
        ),
        ["Bruce Willis"],
        "should not have an 'Undefined Stuff' group"
    );
});

QUnit.test("user_ids grouped: specific empty group added, even if no records", async (assert) => {
    await makeView({ ...ganttViewParams, groupBy: ["user_ids"] });
    assert.deepEqual(
        [...target.querySelectorAll(".o_gantt_row_headers .o_gantt_row_title")].map(
            (el) => el.innerText
        ),
        ["👤 Unassigned", "Jane Doe", "John Doe"],
        "'👤 Unassigned' should be the first group, even if no record exist without user_ids"
    );
    assert.containsN(target, ".o_gantt_row_headers .o-mail-Avatar", 2);
});

QUnit.test("[user_ids, ...] grouped", async (assert) => {
    // add an unassigned task (no user_ids) that has a linked stuff
    ganttViewParams.serverData.models.task.records.push({
        id: 3,
        name: "Gnop",
        start: "2021-06-02 08:00:00",
        stop: "2021-06-12 08:00:00",
        stuff_id: 1,
    });
    await makeView({ ...ganttViewParams, groupBy: ["user_ids", "stuff_id"] });
    assert.deepEqual(
        [...target.querySelectorAll(".o_gantt_row_headers .o_gantt_row_title")].map((el) =>
            el.innerText.trim()
        ),
        [
            "👤 Unassigned",
            "Undefined Stuff",
            "Bruce Willis",
            "Jane Doe",
            "Undefined Stuff",
            "John Doe",
            "Bruce Willis",
        ]
    );
});

QUnit.test("[..., user_ids(, ...)] grouped", async (assert) => {
    await makeView({ ...ganttViewParams, groupBy: ["stuff_id", "user_ids"] });
    assert.deepEqual(
        [...target.querySelectorAll(".o_gantt_row_headers .o_gantt_row_title")].map((el) =>
            el.innerText.trim()
        ),
        [
            "Undefined Stuff",
            "👤 Unassigned",
            "Jane Doe",
            "Bruce Willis",
            "👤 Unassigned",
            "John Doe",
        ]
    );
});

QUnit.test('Empty groupby "Assigned To" and "Project" can be rendered', async function (assert) {
    ganttViewParams.serverData.models.task.records = [];
    await makeView({
        ...ganttViewParams,
        groupBy: ["user_ids", "project_id"],
    });
    assert.deepEqual(
        [...target.querySelectorAll(".o_gantt_row_headers .o_gantt_row_title")].map((el) =>
            el.innerText.trim()
        ),
        ["👤 Unassigned", "🔒 Private"]
    );
});

QUnit.test("progress bar has the correct unit", async (assert) => {
    assert.expect(9);
    await makeView({
        arch: '<gantt js_class="task_gantt" date_start="start" date_stop="stop" progress_bar="user_ids"/>',
        resModel: "task",
        type: "gantt",
        groupBy: ["user_ids"],
        serverData: ganttViewParams.serverData,
        async mockRPC(_, { args, method, model }) {
            if (method === "get_all_deadlines") {
                return { milestone_id: [], project_id: [] };
            }
            if (method === "gantt_progress_bar") {
                assert.strictEqual(model, "task");
                assert.deepEqual(args[0], ["user_ids"]);
                assert.deepEqual(args[1], { user_ids: [100, 101] });
                return {
                    user_ids: {
                        100: { value: 100, max_value: 100 },
                    },
                };
            }
        },
    });
    assert.containsOnce(target, SELECTORS.progressBar);
    assert.containsOnce(target, SELECTORS.progressBarBackground);
    assert.strictEqual(target.querySelector(SELECTORS.progressBarBackground).style.width, "100%");

    assert.containsNone(target, SELECTORS.progressBarForeground);
    await hoverGridCell(2, 1);
    assert.containsOnce(target, SELECTORS.progressBarForeground);
    assert.deepEqual(
        target.querySelector(SELECTORS.progressBarForeground).textContent,
        "100h / 100h"
    );
});

QUnit.test("open a dialog to schedule task", async (assert) => {
    ganttViewParams.serverData.views = {
        "task,false,list": '<tree><field name="name"/></tree>',
    };
    ganttViewParams.serverData.models.task.records.push({
        id: 51,
        name: "Task 51",
        project_id: 1,
        user_ids: 100,
    });
    await makeView({
        arch: '<gantt date_start="start" date_stop="stop" js_class="task_gantt" />',
        resModel: "task",
        type: "gantt",
        serverData: ganttViewParams.serverData,
        mockRPC(route, args) {
            if (args.method === "get_all_deadlines") {
                return { milestone_id: [], project_id: [] };
            } else if (args.method === "schedule_tasks") {
                assert.step("schedule_tasks");
                return {};
            }
        },
    });

    await hoverGridCell(1, 1);
    await clickCell(1, 1);

    await click(target, ".modal .o_list_view tbody tr:nth-child(1) input");
    await nextTick();
    assert.hasClass(target.querySelector(".modal .o_list_view .o_data_row"), "o_data_row_selected");
    await click(target, ".modal footer .o_select_button");
    assert.verifySteps(["schedule_tasks"]);
});

QUnit.test("Lines are displayed in alphabetic order, except for the first one", async (assert) => {
    for (const user of [
        { id: 102, name: "Omega" },
        { id: 103, name: "Theta" },
        { id: 104, name: "Rho" },
        { id: 105, name: "Zeta" },
        { id: 106, name: "Kappa" },
    ]) {
        ganttViewParams.serverData.models["res.users"].records.push(user);
        ganttViewParams.serverData.models.task.records.push({
            id: user.id,
            name: "Citron en Suédois",
            start: "2021-06-02 08:00:00",
            stop: "2021-06-12 08:00:00",
            project_id: 1,
            user_ids: user.id,
        });
    }

    await makeView({
        ...ganttViewParams,
        groupBy: ["user_ids"],
    });

    assert.deepEqual(
        [...target.querySelectorAll(".o_gantt_row_headers .o_gantt_row_title")].map((el) =>
            el.innerText.trim()
        ),
        ["👤 Unassigned", "Jane Doe", "John Doe", "Kappa", "Omega", "Rho", "Theta", "Zeta"],
        "The lines should be sorted by alphabetical order ('👤 Unassigned' is always first)"
    );
});

QUnit.test("Display milestones deadline in project.task gantt view", async (assert) => {
    await makeView({
        ...ganttViewParams,
        groupBy: ["user_ids"],
        async mockRPC(route, args) {
            if (args.method === "get_all_deadlines") {
                const [milestone1, milestone2] =
                    ganttViewParams.serverData.models.milestone.records;
                return {
                    milestone_id: [
                        {
                            ...milestone1,
                            project_id: [1, "My Project"],
                        },
                        {
                            ...milestone2,
                            project_id: [1, "My Project"],
                        },
                    ],
                    project_id: [],
                };
            }
        },
    });

    patchWithCleanup(browser, {
        setTimeout: (fn) => fn(),
    });
    assert.containsN(target, ".o_project_milestone_diamond", 2);
    assert.containsOnce(target, ".o_project_milestone_diamond .o_milestones_reached");
    assert.containsOnce(target, ".o_project_milestone_diamond.o_unreached_milestones");
    let milestoneDiamondEl = target.querySelector(".o_project_milestone_diamond");
    await hoverEl(milestoneDiamondEl);
    assert.containsOnce(target, ".o_popover");
    assert.containsOnce(target, ".o_popover u");
    assert.strictEqual(target.querySelector(".o_popover u").innerText, "My Project");
    assert.containsOnce(target, ".o_popover .o_milestones_reached");
    assert.strictEqual(target.querySelector(".o_popover strong").innerText, "Milestone 1");

    milestoneDiamondEl = target.querySelector(
        ".o_project_milestone_diamond.o_unreached_milestones"
    );
    await hoverEl(milestoneDiamondEl);
    assert.containsOnce(target, ".o_popover");
    assert.containsOnce(target, ".o_popover u");
    assert.strictEqual(target.querySelector(".o_popover u").innerText, "My Project");
    assert.containsOnce(target, ".o_popover .o_unreached_milestones");
    assert.strictEqual(target.querySelector(".o_popover strong").innerText, "Milestone 2");
});

QUnit.test("Display milestones deadline in gantt view of tasks in a project", async (assert) => {
    await makeView({
        ...ganttViewParams,
        groupBy: ["user_ids"],
        async mockRPC(route, args) {
            if (args.method === "get_all_deadlines") {
                const [milestone1, milestone2] =
                    ganttViewParams.serverData.models.milestone.records;
                return {
                    milestone_id: [
                        {
                            ...milestone1,
                            project_id: [1, "My Project"],
                        },
                        {
                            ...milestone2,
                            project_id: [1, "My Project"],
                        },
                    ],
                    project_id: [],
                };
            }
        },
        context: {
            default_project_id: 1,
        },
    });

    patchWithCleanup(browser, {
        setTimeout: (fn) => fn(),
    });
    assert.containsN(target, ".o_project_milestone_diamond", 2);
    assert.containsOnce(target, ".o_project_milestone_diamond .o_milestones_reached");
    assert.containsOnce(target, ".o_project_milestone_diamond.o_unreached_milestones");
    let milestoneDiamondEl = target.querySelector(".o_project_milestone_diamond");
    await hoverEl(milestoneDiamondEl);
    assert.containsOnce(target, ".o_popover");
    assert.containsNone(target, ".o_popover u");
    assert.containsOnce(target, ".o_popover .o_milestones_reached");
    assert.strictEqual(target.querySelector(".o_popover strong").innerText, "Milestone 1");

    milestoneDiamondEl = target.querySelector(
        ".o_project_milestone_diamond.o_unreached_milestones"
    );
    await hoverEl(milestoneDiamondEl);
    assert.containsOnce(target, ".o_popover");
    assert.containsNone(target, ".o_popover u");
    assert.containsOnce(target, ".o_popover .o_unreached_milestones");
    assert.strictEqual(target.querySelector(".o_popover strong").innerText, "Milestone 2");
});

QUnit.test("Display project deadline in the gantt view of task", async (assert) => {
    const myProject = ganttViewParams.serverData.models.project.records[0];
    ganttViewParams.serverData.models.project.records[0] = {
        ...myProject,
        date_start: "2021-01-01",
        date: "2021-06-24",
    };
    ganttViewParams.serverData.models.project.records.push({
        id: 2,
        name: "Other Project",
        date_start: "2021-06-12",
        date: "2021-06-28",
    });
    await makeView({
        ...ganttViewParams,
        groupBy: ["user_ids"],
        async mockRPC(route, args) {
            if (args.method === "get_all_deadlines") {
                return {
                    milestone_id: [],
                    project_id: ganttViewParams.serverData.models.project.records,
                };
            }
        },
    });

    patchWithCleanup(browser, {
        setTimeout: (fn) => fn(),
    });

    assert.containsOnce(target, ".o_gantt_header_cell .o_project_startdate_circle");
    assert.containsN(target, ".o_gantt_header_cell .o_project_deadline_circle", 2);
    assert.containsNone(target, ".o_popover");
    const projectStartDateCircleEl = target.querySelector(
        ".o_gantt_header_cell .o_project_startdate_circle"
    );
    await hoverEl(projectStartDateCircleEl);
    assert.containsOnce(target, ".o_popover");
    assert.containsOnce(target, ".o_popover u");
    assert.strictEqual(
        target.querySelector(".o_popover .popover-body u").innerText,
        "Other Project"
    );
    assert.strictEqual(
        target.querySelector(".o_popover .popover-body em").innerText,
        "Project start"
    );
    const [myProjectDeadlineCircleEl, otherProjectDeadlineCircleEl] = target.querySelectorAll(
        ".o_gantt_header_cell .o_project_deadline_circle"
    );
    await hoverEl(myProjectDeadlineCircleEl);
    assert.containsOnce(target, ".o_popover");
    assert.containsOnce(target, ".o_popover u");
    assert.strictEqual(target.querySelector(".o_popover u").innerText, "My Project");
    assert.strictEqual(
        target.querySelector(".o_popover .popover-body em").innerText,
        "Project due"
    );

    await hoverEl(otherProjectDeadlineCircleEl);
    assert.containsOnce(target, ".o_popover");
    assert.containsOnce(target, ".o_popover u");
    assert.strictEqual(target.querySelector(".o_popover u").innerText, "Other Project");
    assert.strictEqual(
        target.querySelector(".o_popover .popover-body em").innerText,
        "Project due"
    );
});

QUnit.test("Display project and milestones deadline in the gantt view of task", async (assert) => {
    const myProject = ganttViewParams.serverData.models.project.records[0];
    ganttViewParams.serverData.models.project.records[0] = {
        ...myProject,
        date_start: "2021-01-01",
        date: "2021-06-24",
    };
    ganttViewParams.serverData.models.project.records.push({
        id: 2,
        name: "Other Project",
        date_start: "2021-06-12",
        date: "2021-06-28",
    });
    await makeView({
        ...ganttViewParams,
        groupBy: ["user_ids"],
        async mockRPC(route, args) {
            if (args.method === "get_all_deadlines") {
                const [milestone1, milestone2] =
                    ganttViewParams.serverData.models.milestone.records;
                return {
                    milestone_id: [
                        {
                            ...milestone1,
                            project_id: [1, "My Project"],
                        },
                        {
                            ...milestone2,
                            project_id: [1, "My Project"],
                        },
                    ],
                    project_id: ganttViewParams.serverData.models.project.records,
                };
            }
        },
    });

    patchWithCleanup(browser, {
        setTimeout: (fn) => fn(),
    });
    assert.containsN(target, ".o_project_milestone_diamond", 2);
    assert.containsOnce(target, ".o_project_milestone_diamond .o_milestones_reached");
    assert.containsOnce(target, ".o_project_milestone_diamond.o_unreached_milestones");
    let milestoneDiamondEl = target.querySelector(".o_project_milestone_diamond");
    await hoverEl(milestoneDiamondEl);
    assert.containsOnce(target, ".o_popover");
    assert.containsOnce(target, ".o_popover u");
    assert.strictEqual(target.querySelector(".o_popover u").innerText, "My Project");
    assert.containsOnce(target, ".o_popover .o_milestones_reached");
    assert.strictEqual(target.querySelector(".o_popover strong").innerText, "Milestone 1");

    milestoneDiamondEl = target.querySelector(
        ".o_project_milestone_diamond.o_unreached_milestones"
    );
    await hoverEl(milestoneDiamondEl);
    assert.containsOnce(target, ".o_popover");
    assert.containsOnce(target, ".o_popover u");
    assert.strictEqual(target.querySelector(".o_popover u").innerText, "My Project");
    assert.containsOnce(target, ".o_popover .o_unreached_milestones");
    assert.strictEqual(target.querySelector(".o_popover strong").innerText, "Milestone 2");

    assert.containsOnce(target, ".o_gantt_header_cell .o_project_startdate_circle");
    assert.containsN(target, ".o_gantt_header_cell .o_project_deadline_circle", 2);
    const projectStartDateCircleEl = target.querySelector(
        ".o_gantt_header_cell .o_project_startdate_circle"
    );
    await hoverEl(projectStartDateCircleEl);
    assert.containsOnce(target, ".o_popover");
    assert.containsOnce(target, ".o_popover u");
    assert.strictEqual(
        target.querySelector(".o_popover .popover-body u").innerText,
        "Other Project"
    );
    assert.strictEqual(
        target.querySelector(".o_popover .popover-body em").innerText,
        "Project start"
    );
    const [myProjectDeadlineCircleEl, otherProjectDeadlineCircleEl] = target.querySelectorAll(
        ".o_gantt_header_cell .o_project_deadline_circle"
    );
    await hoverEl(myProjectDeadlineCircleEl);
    assert.containsOnce(target, ".o_popover");
    assert.containsOnce(target, ".o_popover u");
    assert.strictEqual(target.querySelector(".o_popover u").innerText, "My Project");
    assert.strictEqual(
        target.querySelector(".o_popover .popover-body em").innerText,
        "Project due"
    );

    await hoverEl(otherProjectDeadlineCircleEl);
    assert.containsOnce(target, ".o_popover");
    assert.containsOnce(target, ".o_popover u");
    assert.strictEqual(target.querySelector(".o_popover u").innerText, "Other Project");
    assert.strictEqual(
        target.querySelector(".o_popover .popover-body em").innerText,
        "Project due"
    );
});

QUnit.test("Display project deadline and milestone date in the same date", async (assert) => {
    const myProject = ganttViewParams.serverData.models.project.records[0];
    ganttViewParams.serverData.models.project.records[0] = {
        ...myProject,
        date_start: "2021-01-01",
        date: "2021-06-24",
    };
    await makeView({
        ...ganttViewParams,
        groupBy: ["user_ids"],
        async mockRPC(route, args) {
            if (args.method === "get_all_deadlines") {
                const milestone3 = ganttViewParams.serverData.models.milestone.records[2];
                return {
                    milestone_id: [
                        {
                            ...milestone3,
                            project_id: [1, "My Project"],
                        },
                    ],
                    project_id: ganttViewParams.serverData.models.project.records,
                };
            }
        },
    });

    patchWithCleanup(browser, {
        setTimeout: (fn) => fn(),
    });
    assert.containsOnce(
        target,
        ".o_gantt_header_cell .o_project_milestone_diamond.o_project_deadline_milestone"
    );
    const projectDeadlineCircleEl = target.querySelector(
        ".o_gantt_header_cell .o_project_milestone_diamond.o_project_deadline_milestone"
    );
    await hoverEl(projectDeadlineCircleEl);
    assert.containsOnce(target, ".o_popover");
    assert.containsOnce(target, ".o_popover u");
    assert.strictEqual(target.querySelector(".o_popover u").innerText, "My Project");
    assert.containsOnce(target, ".o_popover .popover-body");
    assert.strictEqual(
        target.querySelector(".o_popover .popover-body em").innerText,
        "Project due"
    );
    assert.strictEqual(
        target.querySelector(".o_popover .popover-body strong").innerText,
        "Milestone 3"
    );
});

QUnit.test("Display 2 milestones in different project at the same date", async (assert) => {
    ganttViewParams.serverData.models.project.records.push({
        id: 2,
        name: "Other Project",
    });
    ganttViewParams.serverData.models.milestone.records.push({
        id: 4,
        name: "Milestone 4",
        deadline: "2021-06-24",
        project_id: [2, "Other Project"],
    });

    await makeView({
        ...ganttViewParams,
        groupBy: ["user_ids"],
        async mockRPC(route, args) {
            if (args.method === "get_all_deadlines") {
                const milestone3 = ganttViewParams.serverData.models.milestone.records[2];
                const milestone4 = ganttViewParams.serverData.models.milestone.records[3];
                return {
                    milestone_id: [
                        {
                            ...milestone3,
                            project_id: [1, "My Project"],
                        },
                        {
                            ...milestone4,
                            project_id: [2, "Other Project"],
                        },
                    ],
                    project_id: [],
                };
            }
        },
    });

    patchWithCleanup(browser, {
        setTimeout: (fn) => fn(),
    });
    assert.containsOnce(target, ".o_project_milestone_diamond");
    const milestoneDiamondEl = target.querySelector(".o_project_milestone_diamond");
    await hoverEl(milestoneDiamondEl);
    assert.containsOnce(target, ".o_popover");
    assert.containsN(target, ".o_popover u", 2);
    assert.deepEqual(getNodesTextContent(target.querySelectorAll(".o_popover u")), [
        "My Project",
        "Other Project",
    ]);
    assert.containsN(target, ".o_popover .popover-body i.fa-square-o", 2);
    assert.containsN(target, ".o_popover .popover-body strong", 2);
    assert.deepEqual(
        getNodesTextContent(target.querySelectorAll(".o_popover .popover-body strong")),
        ["Milestone 3", "Milestone 4"]
    );
    assert.deepEqual(getNodesTextContent(target.querySelectorAll(".o_popover .popover-body")), [
        "My ProjectMilestone 3Other ProjectMilestone 4",
    ]);
});

QUnit.test("Display project deadline of 2 projects with the same deadline", async (assert) => {
    const myProject = ganttViewParams.serverData.models.project.records[0];
    ganttViewParams.serverData.models.project.records[0] = {
        ...myProject,
        date_start: "2021-01-01",
        date: "2021-06-24",
    };
    ganttViewParams.serverData.models.project.records.push({
        id: 2,
        name: "Other Project",
        date_start: "2021-05-12",
        date: "2021-06-24",
    });

    await makeView({
        ...ganttViewParams,
        groupBy: ["user_ids"],
        async mockRPC(route, args) {
            if (args.method === "get_all_deadlines") {
                return {
                    milestone_id: [],
                    project_id: ganttViewParams.serverData.models.project.records,
                };
            }
        },
    });

    patchWithCleanup(browser, {
        setTimeout: (fn) => fn(),
    });
    assert.containsOnce(target, ".o_gantt_header_cell .o_project_deadline_circle");
    const projectDeadlineCircleEl = target.querySelector(
        ".o_gantt_header_cell .o_project_deadline_circle"
    );
    await hoverEl(projectDeadlineCircleEl);
    assert.containsOnce(target, ".o_popover");
    assert.containsN(target, ".o_popover u", 2);
    assert.deepEqual(getNodesTextContent(target.querySelectorAll(".o_popover u")), [
        "My Project",
        "Other Project",
    ]);
    assert.containsN(target, ".o_popover .popover-body em", 2);
    assert.deepEqual(getNodesTextContent(target.querySelectorAll(".o_popover .popover-body em")), [
        "Project due",
        "Project due",
    ]);
    assert.deepEqual(getNodesTextContent(target.querySelectorAll(".o_popover .popover-body")), [
        "My ProjectProject dueOther ProjectProject due",
    ]);
});

QUnit.test(
    "Display project deadline one day before the start date of the other project",
    async (assert) => {
        const myProject = ganttViewParams.serverData.models.project.records[0];
        ganttViewParams.serverData.models.project.records[0] = {
            ...myProject,
            date_start: "2021-01-01",
            date: "2021-06-24",
        };
        ganttViewParams.serverData.models.project.records.push({
            id: 2,
            name: "Other Project",
            date_start: "2021-06-25",
            date: "2021-10-01",
        });

        await makeView({
            ...ganttViewParams,
            groupBy: ["user_ids"],
            async mockRPC(route, args) {
                if (args.method === "get_all_deadlines") {
                    return {
                        milestone_id: [],
                        project_id: ganttViewParams.serverData.models.project.records,
                    };
                }
            },
        });

        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
        });
        assert.containsOnce(target, ".o_gantt_header_cell .o_project_deadline_circle");
        const projectDeadlineCircleEl = target.querySelector(
            ".o_gantt_header_cell .o_project_deadline_circle"
        );
        await hoverEl(projectDeadlineCircleEl);
        assert.containsOnce(target, ".o_popover");
        assert.containsN(target, ".o_popover u", 2);
        assert.deepEqual(getNodesTextContent(target.querySelectorAll(".o_popover u")), [
            "My Project",
            "Other Project",
        ]);
        assert.containsN(target, ".o_popover .popover-body em", 2);
        assert.deepEqual(
            getNodesTextContent(target.querySelectorAll(".o_popover .popover-body em")),
            ["Project due", "Project start"]
        );
        assert.deepEqual(getNodesTextContent(target.querySelectorAll(".o_popover .popover-body")), [
            "My ProjectProject dueOther ProjectProject start",
        ]);
    }
);

QUnit.test("Copy pill in another row", async (assert) => {
    await makeView({
        ...ganttViewParams,
        groupBy: ["user_ids"],
    });

    assert.deepEqual(getGridContent().rows, [
        {
            title: "👤 Unassigned",
        },
        {
            title: "Jane Doe",
            pills: [{ title: "Blop", level: 0, colSpan: "14 -> 24 (1/2)" }],
        },
        {
            title: "John Doe",
            pills: [{ title: "Yop", level: 0, colSpan: "02 -> 12 (1/2)" }],
        },
    ]);
    await triggerEvent(window, null, "keydown", { key: "Control" });

    // move blop to John Doe
    const { drop, moveTo } = await dragPill("Blop");
    await moveTo({ row: 3, column: 14 });

    assert.hasClass(target.querySelector(SELECTORS.renderer), "o_copying");

    await drop();

    assert.deepEqual(getGridContent().rows, [
        {
            title: "👤 Unassigned",
        },
        {
            title: "Jane Doe",
            pills: [{ title: "Blop", level: 0, colSpan: "14 -> 24 (1/2)" }],
        },
        {
            title: "John Doe",
            pills: [
                { title: "Yop", level: 0, colSpan: "02 -> 12 (1/2)" },
                { title: "Blop (copy)", level: 0, colSpan: "14 -> 24 (1/2)" },
            ],
        },
    ]);
});

QUnit.test("Smart scheduling", async (assert) => {
    ganttViewParams.serverData.models.task.records.push({
        id: 3,
        name: "Gnop",
        user_ids: 100,
    });

    await makeView({
        ...ganttViewParams,
        groupBy: ["user_ids"],
        mockRPC(route, args, performRPC) {
            if (args.method === "schedule_tasks") {
                assert.step("schedule_tasks");
                return performRPC(route, { ...args, method: "write" }, performRPC);
            }
            return ganttViewParams.mockRPC(route, args);
        },
    });

    assert.deepEqual(getGridContent().rows, [
        {
            title: "👤 Unassigned",
        },
        {
            title: "Jane Doe",
            pills: [{ title: "Blop", level: 0, colSpan: "14 -> 24 (1/2)" }],
        },
        {
            title: "John Doe",
            pills: [{ title: "Yop", level: 0, colSpan: "02 -> 12 (1/2)" }],
        },
    ]);

    await hoverGridCell(1, 1);
    await clickCell(1, 1);
    assert.containsOnce(target, ".o_dialog");
    await click(target, ".o_dialog .o_data_cell");
    assert.deepEqual(getGridContent().rows, [
        {
            title: "👤 Unassigned",
        },
        {
            title: "Jane Doe",
            pills: [
                { title: "Gnop", level: 0, colSpan: "01 -> 01" },
                { title: "Blop", level: 0, colSpan: "14 -> 24 (1/2)" },
            ],
        },
        {
            title: "John Doe",
            pills: [{ title: "Yop", level: 0, colSpan: "02 -> 12 (1/2)" }],
        },
    ]);
    assert.verifySteps(["schedule_tasks"]);
});

QUnit.test("Smart scheduling: display warnings", async (assert) => {
    ganttViewParams.serverData.models.task.records.push({
        id: 3,
        name: "Gnop",
        user_ids: 100,
    });

    await makeView({
        ...ganttViewParams,
        groupBy: ["user_ids"],
        mockRPC(route, args) {
            if (args.method === "schedule_tasks") {
                assert.step("schedule_tasks");
                return {
                    test: "test notification",
                };
            }
            return ganttViewParams.mockRPC(route, args);
        },
    });

    assert.deepEqual(getGridContent().rows, [
        {
            title: "👤 Unassigned",
        },
        {
            title: "Jane Doe",
            pills: [{ title: "Blop", level: 0, colSpan: "14 -> 24 (1/2)" }],
        },
        {
            title: "John Doe",
            pills: [{ title: "Yop", level: 0, colSpan: "02 -> 12 (1/2)" }],
        },
    ]);

    await hoverGridCell(1, 1);
    await clickCell(1, 1);
    assert.containsOnce(target, ".o_dialog");
    await click(target, ".o_dialog .o_data_cell");

    await contains(".o_notification");

    assert.containsOnce(target, ".o_notification");
    assert.containsOnce(target, ".o_notification .bg-warning");
    assert.strictEqual(
        target.querySelector(".o_notification").textContent,
        "Warningtest notification",
        "should display the warning"
    );

    assert.verifySteps(["schedule_tasks"]);
});
