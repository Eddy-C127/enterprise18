/* @odoo-module */

import { Domain } from "@web/core/domain";
import {
    click,
    clickSave,
    editInput,
    getFixture,
    patchDate,
    patchTimeZone,
    nextTick,
} from "@web/../tests/helpers/utils";
import { contains } from "@web/../tests/utils";
import { start } from "@mail/../tests/helpers/test_utils";
import { startServer } from "@bus/../tests/helpers/mock_python_environment";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";
import { addModelNamesToFetch } from '@bus/../tests/helpers/model_definitions_helpers';

addModelNamesToFetch([
    'resource.resource',
    'hr.employee',
    'planning.slot',
]);

function enrichRowsUnavailabilites(rows, parent_unavailabilities = false) {
    const enrichedRows = [];
    const row_unavailabilities = {
        1: [
            {
                start: '2022-10-08 23:00:00',
                stop: '2022-10-09 22:59:59',
            },
            {
                start: '2022-10-10 10:00:00',
                stop: '2022-10-11 06:00:00',
            },
        ],
        false: [
            {
                start: '2022-10-08 23:00:00',
                stop: '2022-10-09 22:59:59',
            },
            {
                start: '2022-10-10 10:00:00',
                stop: '2022-10-11 06:00:00',
            },
        ],
    };

    for (const row of rows) {
        const unavailabilities = parent_unavailabilities || row_unavailabilities[row.resId];
        const row_values = {
            ...row,
            unavailabilities,
        };
        if (row.rows) {
            row_values.rows = enrichRowsUnavailabilites(row.rows, unavailabilities);
        }
        enrichedRows.push(row_values);
    }

    return enrichedRows;
}

import {
    clickCell,
    editPill,
    getGridContent,
    hoverGridCell,
    SELECTORS,
    CLASSES,
    getPillWrapper,
    dragPill,
    resizePill,
    getTexts,
} from "@web_gantt/../tests/helpers";

async function ganttResourceWorkIntervalRPC(_, args) {
    if (args.method === "gantt_resource_work_interval") {
        return [
            {
                1: [
                    ["2022-10-10 06:00:00", "2022-10-10 10:00:00"], //Monday    4h
                    ["2022-10-11 06:00:00", "2022-10-11 10:00:00"], //Tuesday   5h
                    ["2022-10-11 11:00:00", "2022-10-11 12:00:00"],
                    ["2022-10-12 06:00:00", "2022-10-12 10:00:00"], //Wednesday 6h
                    ["2022-10-12 11:00:00", "2022-10-12 13:00:00"],
                    ["2022-10-13 06:00:00", "2022-10-13 10:00:00"], //Thursday  7h
                    ["2022-10-13 11:00:00", "2022-10-13 14:00:00"],
                    ["2022-10-14 06:00:00", "2022-10-14 10:00:00"], //Friday    8h
                    ["2022-10-14 11:00:00", "2022-10-14 15:00:00"],
                ],
                false: [
                    ["2022-10-10 06:00:00", "2022-10-10 10:00:00"],
                    ["2022-10-10 11:00:00", "2022-10-10 15:00:00"],
                    ["2022-10-11 06:00:00", "2022-10-11 10:00:00"],
                    ["2022-10-11 11:00:00", "2022-10-11 15:00:00"],
                    ["2022-10-12 06:00:00", "2022-10-12 10:00:00"],
                    ["2022-10-12 11:00:00", "2022-10-12 15:00:00"],
                    ["2022-10-13 06:00:00", "2022-10-13 10:00:00"],
                    ["2022-10-13 11:00:00", "2022-10-13 15:00:00"],
                    ["2022-10-14 06:00:00", "2022-10-14 10:00:00"],
                    ["2022-10-14 11:00:00", "2022-10-14 15:00:00"],
                ],
            },
            { false: true },
        ];
    } else if (args.method === "gantt_unavailability") {
        const rows = args.args[4];
        return enrichRowsUnavailabilites(rows);
    } else if (args.method === "gantt_progress_bar") {
        return {
            resource_id: {
                1: {
                    value: 16.4,
                    max_value: 40,
                    employee_id: 1,
                    is_material_resource: true,
                    display_popover_material_resource: false
                },
            },
        };
    }
}

let serverData;
let target;
QUnit.module("Views", (hooks) => {
    hooks.beforeEach(async () => {
        serverData = {
            models: {
                task: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                        start_datetime: { string: "Start Date", type: "datetime" },
                        end_datetime: { string: "Stop Date", type: "datetime" },
                        time: { string: "Time", type: "float" },
                        resource_id: {
                            string: "Assigned to",
                            type: "many2one",
                            relation: "resource.resource",
                        },
                        department_id: {
                            string: "Department",
                            type: "many2one",
                            relation: "department",
                        },
                        role_id: {
                            string: "Role",
                            type: "many2one",
                            relation: "role",
                        },
                        employee_id: {
                            string: "Employee Assigned",
                            type: "many2one",
                            relation: "employee_id",
                        },
                        active: { string: "active", type: "boolean", default: true },
                    },
                    records: [],
                },
                "resource.resource": {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                        employee_id: { string: "ID", type: "integer" },
                    },
                    records: [],
                },
                department: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                    },
                    records: [],
                },
                role: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                    },
                    records: [],
                },
                employee_id: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                    },
                    records: [],
                },
            },
            views: {
                "foo,false,gantt": `<gantt/>`,
                "foo,false,search": `<search/>`,
            },
        };
        setupViewRegistries();
        target = getFixture();
    });

    QUnit.module("PlanningGanttView");

    QUnit.test("empty gantt view: send schedule", async function () {
        patchDate(2018, 11, 20, 8, 0, 0);
        serverData.models.task.records = [];
        await makeView({
            type: "gantt",
            resModel: "task",
            serverData,
            arch: `<gantt js_class="planning_gantt" date_start="start_datetime" date_stop="end_datetime"/>`,
            domain: Domain.FALSE.toList(),
            groupBy: ["resource_id"],
        });
        await click(target.querySelector(".o_gantt_button_send_all.btn-primary"));
        await contains(".o_notification:has(.o_notification_bar.bg-danger)", {
            text: "The shifts have already been published, or there are no shifts to publish.",
        });
    });

    QUnit.test("empty gantt view with sample data: send schedule", async function (assert) {
        patchDate(2018, 11, 20, 8, 0, 0);
        serverData.models.task.records = [];
        await makeView({
            type: "gantt",
            resModel: "task",
            serverData,
            arch: `<gantt js_class="planning_gantt" date_start="start_datetime" date_stop="end_datetime" sample="1"/>`,
            domain: Domain.FALSE.toList(),
            groupBy: ["resource_id"],
        });
        assert.hasClass(target.querySelector(".o_gantt_view .o_content"), "o_view_sample_data");
        assert.ok(target.querySelectorAll(".o_gantt_row_headers .o_gantt_row_header").length >= 2);
        await click(target.querySelector(".o_gantt_button_send_all.btn-primary"));
        await contains(".o_notification:has(.o_notification_bar.bg-danger)", {
            text: "The shifts have already been published, or there are no shifts to publish.",
        });
    });

    QUnit.test('add record in empty gantt with sample="1"', async function (assert) {
        assert.expect(6);

        serverData.models.task.records = [];
        serverData.views = {
            "task,false,form": `
                <form>
                    <field name="name"/>
                    <field name="start_datetime"/>
                    <field name="end_datetime"/>
                    <field name="resource_id"/>
                </form>`,
        };

        await makeView({
            type: "gantt",
            resModel: "task",
            serverData,
            arch: '<gantt js_class="planning_gantt" date_start="start_datetime" date_stop="end_datetime" sample="1" plan="false"/>',
            groupBy: ["resource_id"],
            mockRPC: ganttResourceWorkIntervalRPC,
        });

        assert.hasClass(target.querySelector(".o_gantt_view .o_content"), "o_view_sample_data");
        assert.ok(target.querySelectorAll(".o_gantt_row_headers .o_gantt_row_header").length >= 2);
        const firstRow = target.querySelector(".o_gantt_row_headers .o_gantt_row_header");
        assert.strictEqual(firstRow.innerText, "Open Shifts");
        assert.doesNotHaveClass(firstRow, "o_sample_data_disabled");

        await hoverGridCell(1, 1);
        await clickCell(1, 1);

        await editInput(target, ".modal .o_form_view .o_field_widget[name=name] input", "new task");
        await clickSave(target.querySelector(".modal"));

        assert.doesNotHaveClass(
            target.querySelector(".o_gantt_view .o_content"),
            "o_view_sample_data"
        );
        assert.containsOnce(target, ".o_gantt_pill_wrapper");
    });

    QUnit.test("open a dialog to add a new task", async function (assert) {
        assert.expect(4);

        patchTimeZone(0);

        serverData.views = {
            "task,false,form": `
                <form>
                    <field name="name"/>
                    <field name="start_datetime"/>
                    <field name="end_datetime"/>
                '</form>
            `,
        };

        const now = luxon.DateTime.now();

        await makeView({
            type: "gantt",
            resModel: "task",
            serverData,
            arch: '<gantt js_class="planning_gantt" default_scale="day" date_start="start_datetime" date_stop="end_datetime"/>',
            mockRPC(_, args) {
                if (args.method === "onchange") {
                    assert.strictEqual(
                        args.kwargs.context.default_end_datetime,
                        now.startOf("day").toFormat("yyyy-MM-dd 23:59:59")
                    );
                }
            },
        });

        await click(target, ".d-xl-inline-flex .o_gantt_button_add.btn-primary");
        // check that the dialog is opened with prefilled fields
        assert.containsOnce(target, ".modal");
        assert.strictEqual(
            target.querySelector(".o_field_widget[name=start_datetime] .o_input").value,
            now.toFormat("MM/dd/yyyy 00:00:00")
        );
        assert.strictEqual(
            target.querySelector(".o_field_widget[name=end_datetime] .o_input").value,
            now.toFormat("MM/dd/yyyy 23:59:59")
        );
    });

    QUnit.test(
        "gantt view collapse and expand empty rows in multi groupby",
        async function (assert) {
            assert.expect(7);

            await makeView({
                type: "gantt",
                resModel: "task",
                serverData,
                arch: '<gantt js_class="planning_gantt" date_start="start_datetime" date_stop="end_datetime"/>',
                groupBy: ["department_id", "role_id", "resource_id"],
            });

            const { rows } = getGridContent();
            assert.deepEqual(
                rows.map((r) => r.title),
                ["Open Shifts", "Undefined Role", "Open Shifts"]
            );

            function getRow(index) {
                return target.querySelectorAll(".o_gantt_row_headers > .o_gantt_row_header")[index];
            }

            await click(getRow(0));
            assert.doesNotHaveClass(getRow(0), "o_group_open");
            await click(getRow(0));
            assert.hasClass(getRow(0), "o_group_open");
            assert.strictEqual(getRow(2).innerText, "Open Shifts");
            await click(getRow(1));
            assert.doesNotHaveClass(getRow(1), "o_group_open");
            await click(getRow(1));
            assert.hasClass(getRow(1), "o_group_open");
            assert.strictEqual(getRow(2).innerText, "Open Shifts");
        }
    );

    function _getCreateViewArgsForGanttViewTotalsTests() {
        patchDate(2022, 9, 13, 0, 0, 0);
        serverData.models["resource.resource"].records.push({ id: 1, name: "Resource 1" });
        serverData.models.task.fields.allocated_percentage = {
            string: "Allocated Percentage",
            type: "float",
        };
        serverData.models.task.records.push({
            id: 1,
            name: "test",
            start_datetime: "2022-10-09 00:00:00",
            end_datetime: "2022-10-16 22:00:00",
            resource_id: 1,
            allocated_percentage: 50,
        });
        return {
            type: "gantt",
            resModel: "task",
            serverData,
            arch: `
                <gantt js_class="planning_gantt" date_start="start_datetime" date_stop="end_datetime" total_row="1" default_scale="week"
                        precision="{'day': 'hour:full', 'week': 'day:full', 'month': 'day:full', 'year': 'day:full'}">
                    <field name="allocated_percentage"/>
                    <field name="resource_id"/>
                    <field name="name"/>
                </gantt>
            `,
            mockRPC: ganttResourceWorkIntervalRPC,
        };
    }

    QUnit.test(
        "gantt view totals height is taking unavailability into account instead of pills count",
        async function (assert) {
            await makeView(_getCreateViewArgsForGanttViewTotalsTests());

            // 2022-10-09 and 2022-10-15 are days off => no pill has to be found in first and last columns
            assert.deepEqual(
                [...target.querySelectorAll(".o_gantt_row_total .o_gantt_pill_wrapper")].map(
                    (el) => el.style.gridColumn.split(" / ")[0]
                ),
                ["2", "3", "4", "5", "6"]
            );

            // Max of allocated hours = 4:00 (50% * 8:00)
            assert.deepEqual(
                [...target.querySelectorAll(".o_gantt_row_total .o_gantt_pill")].map(
                    (el) => el.style.height
                ),
                [
                    "45%", // => 2:00 = 50% of 4:00 => 0.5 * 90% = 45%
                    "56.25%", // => 2:30 = 62.5% of 4:00 => 0.625 * 90% = 56.25%
                    "67.5%", // => 3:00 = 75% of 4:00 => 0.75 * 90% = 67.5%
                    "78.75%", // => 3:30 = 87.5% of 4:00 => 0.85 * 90% = 78.75%
                    "90%", // => 4:00 = 100% of 4:00 => 1 * 90% = 90%
                ]
            );
        }
    );

    QUnit.test(
        "gantt view totals are taking unavailability into account for the total display",
        async function (assert) {
            await makeView(_getCreateViewArgsForGanttViewTotalsTests());
            assert.deepEqual(
                [...target.querySelectorAll(".o_gantt_row_total .o_gantt_pill")].map(
                    (el) => el.innerText
                ),
                ["02:00", "02:30", "03:00", "03:30", "04:00"]
            );
        }
    );

    QUnit.test(
        "gantt view totals are taking unavailability into account according to scale",
        async function (assert) {
            const createViewArgs = _getCreateViewArgsForGanttViewTotalsTests();
            createViewArgs.arch = createViewArgs.arch.replace(
                'default_scale="week"',
                'default_scale="year"'
            );

            await makeView(createViewArgs);

            assert.containsOnce(target, ".o_gantt_cells .o_gantt_pill");
            assert.containsOnce(target, ".o_gantt_row_total .o_gantt_pill");
            assert.strictEqual(
                target.querySelector(".o_gantt_row_total .o_gantt_pill").innerText,
                "15:00"
            );
        }
    );

    QUnit.test(
        "reload data after having unlink a record in planning_form",
        async function (assert) {
            serverData.views = {
                "task,false,form": `
                <form js_class="planning_form">
                    <field name="name"/>
                    <field name="start_datetime"/>
                    <field name="end_datetime"/>
                    <field name="resource_id"/>
                    <footer class="d-flex flex-wrap">
                        <button name="unlink" type="object" icon="fa-trash" title="Remove" class="btn-secondary" close="1"/>
                    </footer>
                </form>`,
            };
            await makeView(_getCreateViewArgsForGanttViewTotalsTests());

            assert.containsOnce(target, ".o_gantt_cells .o_gantt_pill");

            await editPill("test");
            await click(target, ".modal footer button[name=unlink]"); // click on trash icon
            await click(target, ".o_dialog:nth-child(2) .modal footer button:nth-child(1)"); // click on "Ok" in confirmation dialog

            assert.containsNone(target, ".o_gantt_cells .o_gantt_pill");
        }
    );

    QUnit.test("progress bar has the correct unit", async (assert) => {
        const makeViewArgs = _getCreateViewArgsForGanttViewTotalsTests();
        assert.expect(9);
        await makeView({
            ...makeViewArgs,
            arch: `<gantt js_class="planning_gantt" date_start="start_datetime" date_stop="end_datetime" progress_bar="resource_id"/>`,
            groupBy: ["resource_id"],
            async mockRPC(_, { args, method, model }) {
                if (method === "gantt_progress_bar") {
                    assert.strictEqual(model, "task");
                    assert.deepEqual(args[0], ["resource_id"]);
                    assert.deepEqual(args[1], { resource_id: [1] });
                    return {
                        resource_id: {
                            1: { value: 100, max_value: 100 },
                        },
                    };
                }
                return makeViewArgs.mockRPC(...arguments);
            },
        });
        assert.containsOnce(target, SELECTORS.progressBar);
        assert.containsOnce(target, SELECTORS.progressBarBackground);
        assert.strictEqual(
            target.querySelector(SELECTORS.progressBarBackground).style.width,
            "100%"
        );

        assert.containsNone(target, SELECTORS.progressBarForeground);
        await hoverGridCell(2, 1);
        assert.containsOnce(target, SELECTORS.progressBarForeground);
        assert.deepEqual(
            target.querySelector(SELECTORS.progressBarForeground).textContent,
            "100h / 100h"
        );
    });

    QUnit.test("total computes correctly for open shifts", async (assert) => {
        // For open shifts and shifts with flexible resource, the total should be computed
        // based on the shifts' duration, each maxed to the calendar's hours per day.
        // Not based on the intersection of the shifts and the calendar.
        const createViewArgs = _getCreateViewArgsForGanttViewTotalsTests();
        serverData.models.task.fields.allocated_hours = {
            string: "Allocated Hours",
            type: "float",
        };
        serverData.models.task.records[0] = {
            id: 1,
            name: "test",
            start_datetime: "2022-10-10 04:00:00",
            end_datetime: "2022-10-10 12:00:00",
            resource_id: false,
            allocated_hours: 8,
            allocated_percentage: 100,
        };
        createViewArgs.arch = createViewArgs.arch.replace(
            'default_scale="week"',
            'default_scale="week" default_group_by="resource_id"'
        ).replace(
            '<field name="allocated_percentage"/>',
            '<field name="allocated_percentage"/><field name="allocated_hours"/>',
        );
        await makeView(createViewArgs);
        assert.strictEqual(
            target.querySelector(SELECTORS.rowTotal).textContent,
            "08:00"
        );
    });

    QUnit.test("the grouped gantt view is coloured correctly", async (assert) => {
        patchDate(2022, 9, 10, 0, 0, 0);
        const pyEnv = await startServer();
        const employeeId = pyEnv['hr.employee'].create([
            { name: "Employee 1" },
        ])
        const resourceId = pyEnv['resource.resource'].create([
            { name: "Resource 1", employee_id: [employeeId], resource_type: 'user' },
        ]);
        pyEnv['planning.slot'].create([
            {
                name: "underplanned test slot",
                start_datetime: "2022-10-11 08:00:00",
                end_datetime: "2022-10-11 10:00:00",
                resource_id: resourceId,
                employee_id: employeeId,
                allocated_percentage: 100,
            },
            {
                name: "perfect test slot",
                start_datetime: "2022-10-12 06:00:00",
                end_datetime: "2022-10-12 13:00:00",
                resource_id: resourceId,
                employee_id: employeeId,
                allocated_percentage: 100,
            },
            {
                name: "overplanned test slot",
                start_datetime: "2022-10-13 06:00:00",
                end_datetime: "2022-10-13 16:00:00",
                resource_id: resourceId,
                employee_id: employeeId,
                allocated_percentage: 120,
            },
        ])
        const views = {
            'planning.slot,false,gantt': `
                <gantt js_class="planning_gantt" date_start="start_datetime" date_stop="end_datetime" total_row="1" default_scale="week"
                precision="{'day': 'hour:full', 'week': 'day:full', 'month': 'day:full', 'year': 'day:full'}" display_unavailability="1" progress_bar="resource_id">
                    <field name="allocated_percentage"/>
                    <field name="resource_id"/>
                    <field name="employee_id"/>
                    <field name="name"/>
                </gantt>`
        }
        const { openView } = await start({
            mockRPC: ganttResourceWorkIntervalRPC,
            serverData: { views },
        });
        await openView({
            res_model: 'planning.slot',
            views: [[false, 'gantt']],
            context: {
                group_by: ['resource_id', 'name'],
            },
        });

        await nextTick();

        assert.containsN(target, '.o_gantt_group_pill', 5, "The employee should have group pills only on the work calendar days");
        assert.containsOnce(target, '.bg-success.border-success', "One of the grouped pills should be green because the resource is perfectly planned");

        assert.containsN(target, '.bg-warning.border-warning', 3, "Three of the grouped pills should be orange because the resource is under planned");
        assert.containsOnce(target, '.bg-danger.border-danger', "One of the grouped pills should be red because the resource is over planned");

    });
    QUnit.test(
        "Gantt Planning : pill name should not display allocated hours if allocated_percentage is 100%",
        async (assert) => {
            patchDate(2022, 9, 13, 0, 0, 0);
            serverData.models.task.fields.allocated_hours = {
                string: "Allocated hours",
                type: "float",
            };
            serverData.models.task.fields.allocated_percentage = {
                string: "Allocated percentage",
                type: "float",
            };
            serverData.models.task.records = [
                {
                    id: 1,
                    name: "Task 1",
                    start_datetime: "2022-10-09 08:30:00",
                    end_datetime: "2022-10-09 17:30:00", // span only one day
                    allocated_hours: 4,
                    allocated_percentage: 50,
                },
                {
                    id: 2,
                    name: "Task 2",
                    start_datetime: "2022-10-09 08:30:00",
                    end_datetime: "2022-10-09 17:30:00", // span only one day
                    allocated_hours: 8,
                    allocated_percentage: 100,
                },
            ];

            await makeView({
                type: "gantt",
                resModel: "task",
                serverData,
                arch: `
                    <gantt js_class="planning_gantt" date_start="start_datetime" date_stop="end_datetime" default_scale="week" pill_label="True">
                        <field name="allocated_hours"/>
                        <field name="allocated_percentage"/>
                    </gantt>
                `,
                groupBy: ["resource_id"],
                mockRPC: ganttResourceWorkIntervalRPC,
            });

            assert.deepEqual(
                getTexts(".o_gantt_pill").map((t) => t.replace(/\s*/g, "")),
                ["9:30AM-6:30PM(4h)-Task1", "9:30AM-6:30PM-Task2"]
            );
        }
    );

    QUnit.test("Resize or Drag-Drop should open recurrence update wizard", async (assert) => {
        patchDate(2022, 9, 10, 0, 0, 0);
        const pyEnv = await startServer();
        const employeeId = pyEnv['hr.employee'].create([
            { name: "Employee 1" },
        ]);
        const resourceId = pyEnv['resource.resource'].create([
            { name: "Resource 1", employee_id: [employeeId], resource_type: 'user' },
        ]);

        pyEnv['planning.slot'].create({
            name: "Task With Repeat",
            start_datetime: "2022-10-11 08:00:00",
            end_datetime: "2022-10-11 10:00:00",
            resource_id: resourceId,
            employee_id: employeeId,
            allocated_percentage: 100,
            repeat: true,
        });

        const views = {
            'planning.slot,false,gantt': `
                <gantt js_class="planning_gantt" date_start="start_datetime" date_stop="end_datetime" total_row="1" default_scale="month"
                precision="{'day': 'hour:full', 'week': 'day:full', 'month': 'day:full', 'year': 'day:full'}" display_unavailability="1" progress_bar="resource_id">
                    <field name="allocated_percentage"/>
                    <field name="resource_id"/>
                    <field name="employee_id"/>
                    <field name="name"/>
                    <field name="repeat"/>
                </gantt>`,
        }
        const { openView } = await start({
            mockRPC: ganttResourceWorkIntervalRPC,
            serverData: { views },
        });
        await openView({
            res_model: 'planning.slot',
            views: [[false, 'gantt']],
            context: {
                group_by: ['resource_id', 'name'],
            },
        });

        assert.hasClass(getPillWrapper("Task With Repeat"), CLASSES.draggable);
        assert.deepEqual(getGridContent().rows[3], {
            pills: [
                {
                    "title": "Task With Repeat",
                    "level": 0,
                    "colSpan": "11 -> 11",
                },
            ],
            title: "Task With Repeat",
        });

        // move a pill in the next cell (+1 day)
        const { drop } = await dragPill("Task With Repeat");
        await drop({ row: 3, column: 12 });
        // click on the confirm button
        await click(Object.entries(target.querySelectorAll('.btn-primary')).at(-1)[1]);
        assert.deepEqual(getGridContent().rows[3], {
            pills: [
                {
                    "title": "Task With Repeat",
                    "level": 0,
                    "colSpan": "12 -> 12",
                },
            ],
            title: "Task With Repeat",
        });

        // resize a pill in the next cell (+1 day)
        await resizePill(getPillWrapper("Task With Repeat"), "end", 1);
        // click on the confirm button
        await click(Object.entries(target.querySelectorAll('.btn-primary')).at(-1)[1]);
        assert.deepEqual(getGridContent().rows[3], {
            pills: [
                {
                    "title": "Task With Repeat",
                    "level": 0,
                    "colSpan": "12 -> 13",
                },
            ],
            title: "Task With Repeat",
        });
    });
});
