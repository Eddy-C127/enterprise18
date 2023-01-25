import { getFixture, getNodesTextContent } from "@web/../tests/helpers/utils";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";

let target, serverData;

QUnit.module("Planning", (hooks) => {
    hooks.beforeEach(() => {
        serverData = {
            models: {
                "planning.slot": {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        start_datetime: { string: "Start Date Time", type: "datetime" },
                        end_datetime: { string: "End Date Time", type: "datetime" },
                        allocated_hours: { string: "Allocated Hours", type: "float_time" },
                        allocated_percentage: {
                            string: "Allocated Percentage",
                            type: "percentage",
                        },
                        role_id: { string: "Role", type: "many2one", relation: "planning.role" },
                        conflicting_slot_ids: {
                            string: "Conflicting Slot Ids",
                            type: "many2many",
                            relation: "planning.slot",
                        },
                        // two fields added in the relatedFields method of the conflictingSlotIdsField when project_forecast/sale_planning are installed
                        project_id: { string: "Project", type: "many2one", relation: "project" },
                        sale_line_id: {
                            string: "Sale Line",
                            type: "many2one",
                            relation: "sale.order.line",
                        },
                    },
                    records: [
                        {
                            id: 1,
                            start_datetime: "2021-09-01 08:00:00",
                            end_datetime: "2021-09-01 12:00:00",
                            allocated_hours: 4,
                            allocated_percentage: 100,
                            role_id: 1,
                            conflicting_slot_ids: [2, 3],
                        },
                        {
                            id: 2,
                            start_datetime: "2021-09-01 08:00:00",
                            end_datetime: "2021-09-01 12:00:00",
                            allocated_hours: 4,
                            allocated_percentage: 100,
                            role_id: 1,
                            conflicting_slot_ids: [1, 3],
                        },
                        {
                            id: 3,
                            start_datetime: "2021-09-01 10:00:00",
                            end_datetime: "2021-09-01 13:00:00",
                            allocated_hours: 2,
                            allocated_percentage: 66.67,
                            role_id: false,
                            conflicting_slot_ids: [1, 2, 4, 5, 6, 7],
                        },
                        {
                            id: 4,
                            start_datetime: "2021-09-01 12:30:00",
                            end_datetime: "2021-09-01 17:30:00",
                            allocated_hours: 5,
                            allocated_percentage: 100,
                            role_id: 1,
                            conflicting_slot_ids: [3, 5, 6],
                        },
                        {
                            id: 5,
                            start_datetime: "2021-09-01 12:30:00",
                            end_datetime: "2021-09-01 17:30:00",
                            allocated_hours: 5,
                            allocated_percentage: 100,
                            role_id: false,
                            conflicting_slot_ids: [3, 4, 6],
                        },
                        {
                            id: 6,
                            start_datetime: "2021-09-01 12:30:00",
                            end_datetime: "2021-09-01 18:00:00",
                            allocated_hours: 5.5,
                            allocated_percentage: 100,
                            role_id: false,
                            conflicting_slot_ids: [3, 4, 5],
                        },
                        {
                            id: 7,
                            start_datetime: "2021-09-01 12:30:00",
                            end_datetime: "2021-09-01 17:30:00",
                            allocated_hours: 5,
                            allocated_percentage: 100,
                            role_id: false,
                            conflicting_slot_ids: [3, 4, 5],
                        },
                    ],
                },
                "planning.role": {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                    },
                    records: [{ id: 1, name: "Developer" }],
                },
                // to avoid any issues due to the patch methods made in sale_planning and project_forecast modules
                project: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                    },
                    records: [],
                },
                "sale.order.line": {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                    },
                    records: [],
                },
            },
            views: {
                "planning.slot,false,form":
                    '<form><field name="conflicting_slot_ids" widget="conflicting_slot_ids"/></form>',
            },
        };
        target = getFixture();
        setupViewRegistries();
    });

    QUnit.module("ConflictingSlotIdsField");

    QUnit.test("display conflicting slot ids field in the form view", async (assert) => {
        await makeView({
            serverData,
            resId: 1,
            resModel: "planning.slot",
            type: "form",
        });

        assert.containsOnce(target, ".o_field_conflicting_slot_ids[name=conflicting_slot_ids]");
        assert.strictEqual(
            target.querySelector(".o_field_conflicting_slot_ids > p").textContent,
            " Prepare for the ultimate multi-tasking challenge: "
        );
        assert.containsN(target, ".o_conflicting_slot", 2);
        assert.deepEqual(getNodesTextContent(target.querySelectorAll(".o_conflicting_slot")), [
            "09/01/2021 09:00:0009/01/2021 13:00:00(4h) (100.00%) - Developer",
            "09/01/2021 11:00:0009/01/2021 14:00:00(2h) (66.67%) ",
        ]);
    });

    QUnit.test("display 5 shifts in conflict", async (assert) => {
        await makeView({
            serverData,
            resId: 3,
            resModel: "planning.slot",
            type: "form",
        });

        assert.containsOnce(target, ".o_field_conflicting_slot_ids[name=conflicting_slot_ids]");
        assert.strictEqual(
            target.querySelector(".o_field_conflicting_slot_ids > p").textContent,
            " Prepare for the ultimate multi-tasking challenge: "
        );
        assert.containsN(target, ".o_conflicting_slot", 5);
        assert.deepEqual(getNodesTextContent(target.querySelectorAll(".o_conflicting_slot")), [
            "09/01/2021 09:00:0009/01/2021 13:00:00(4h) (100.00%) - Developer",
            "09/01/2021 09:00:0009/01/2021 13:00:00(4h) (100.00%) - Developer",
            "09/01/2021 13:30:0009/01/2021 18:30:00(5h) (100.00%) - Developer",
            "09/01/2021 13:30:0009/01/2021 18:30:00(5h) (100.00%) ",
            "09/01/2021 13:30:0009/01/2021 19:00:00(5h30) (100.00%) ",
        ]);
    });
});
