/** @odoo-module **/

import { startServer } from "@bus/../tests/helpers/mock_python_environment";
import { start } from "@mail/../tests/helpers/test_utils";
import { patchDate, patchWithCleanup, click } from "@web/../tests/helpers/utils";
import { contains } from "@web/../tests/utils";
import { setupViewRegistries } from "@web/../tests/views/helpers";

import { patchAvatarCardPopover } from "@hr/components/avatar_card/avatar_card_popover_patch";
import { AvatarCardPopover } from "@mail/discuss/web/avatar_card/avatar_card_popover";
import { patchAvatarCardResourcePopover } from "@planning/components/avatar_card_resource/avatar_card_resource_popover_patch";
import { AvatarCardResourcePopover } from "@resource_mail/components/avatar_card_resource/avatar_card_resource_popover";
import { patchM2oResourceField } from "@planning/views/fields/many2one_avatar_resource/many2one_avatar_resource_field_patch";
import {
    many2OneAvatarResourceField,
    kanbanMany2OneAvatarResourceField
} from "@resource_mail/views/fields/many2one_avatar_resource/many2one_avatar_resource_field";



QUnit.module("M2OAvatarResourceWidgetTestsPlanning", {
    /* Main Goals of these tests:
        - Tests the change made in planning to avatar card preview for resource:
            - Roles appear as tags on the card
            - Card should be displayed for material resources with at least 2 roles
        - Test the integration of the card in the Gantt view
     */
    async beforeEach() {
        this.serverData = {};
        setupViewRegistries();
        patchWithCleanup(AvatarCardPopover.prototype, patchAvatarCardPopover);
        patchWithCleanup(AvatarCardResourcePopover.prototype, patchAvatarCardResourcePopover);
        patchWithCleanup(many2OneAvatarResourceField, patchM2oResourceField);
        patchWithCleanup(kanbanMany2OneAvatarResourceField, patchM2oResourceField);

        /* 1. Create data
           4 type of records tested:
            - Planning slot linked to a material resource with only one role
                - clicking the icon should not open any popover
            - Planning slot linked to a material resource with two roles
                - clicking the icon should open a card popover with resource name and roles
            - Planning slot linked to a human resource not linked to a user
                - a card popover should open including the roles of the employee
            - Planning slot linked to a human resource linked to a user
                - a card popover should open including the roles of the employee
        */

        const pyEnv = await startServer();
        this.data = {};

        // Roles
        [this.data.roleTesterId, this.data.roleITSpecialistId] = pyEnv["planning.role"].create([{
            name: "Tester",
            color: 1,
        }, {
            name: "IT Specialist",
            color: 2,
        }]);

        // User
        this.data.partnerPierreId = pyEnv["res.partner"].create({
            name: "Pierre",
        });
        this.data.userPierreId = pyEnv["res.users"].create({
            name: "Pierre",
            partner_id: this.data.partnerPierreId,
        });

        // Resources
        [this.data.resourceComputer1Id,
         this.data.resourceComputer2Id,
         this.data.resourceMarieId,
         this.data.resourcePierreId] = pyEnv["resource.resource"].create([{
            name: "Continuity testing computer",
            resource_type: "material",
            role_ids: [this.data.roleTesterId],
        }, {
            name: "Integration testing computer",
            resource_type: "material",
            role_ids: [this.data.roleTesterId, this.data.roleITSpecialistId],
        }, {
            name: "Marie",
            resource_type: "user",
            role_ids: [this.data.roleTesterId],
        }, {
            name: "Pierre",
            resource_type: "user",
            role_ids: [this.data.roleITSpecialistId],
            user_id: this.data.userPierreId,
            im_status: "online",
        }]);

        // Employees
        const employeePierreData = {
            name: "Pierre",
            user_id: this.data.user1Id,
            user_partner_id: this.data.partner1Id,
        };
        pyEnv["hr.employee"].create([{
            name: "Marie",
            resource_id: this.data.resourceMarieId,
        }, {
            ...employeePierreData,
            resource_id: this.data.resourcePierreId,
        }]);
        // Imitating the server behavior by creating an hr.employee.public record with the same data and same id
        pyEnv["hr.employee.public"].create([{ name: "Marie" }, employeePierreData]);

        // Planning slots
        [this.data.planning1Id,
         this.data.planning2Id,
         this.data.planning3Id,
         this.data.planning4Id] = pyEnv["planning.slot"].create([{
            display_name: "Planning Slot tester 1",
            resource_id: this.data.resourceComputer1Id,
            resource_type: "material",
            resource_roles: [this.data.roleTesterId],
            user_id: false,
            start_datetime: "2023-11-09 00:00:00",
            end_datetime: "2023-11-09 22:00:00",
        }, {
            display_name: "Planning slot integration tester",
            resource_id: this.data.resourceComputer2Id,
            resource_type: "material",
            resource_roles: [this.data.roleTesterId, this.data.roleITSpecialistId],
            user_id: false,
            start_datetime: "2023-11-09 00:00:00",
            end_datetime: "2023-11-09 22:00:00",
        }, {
            display_name: "Planning slot Marie",
            resource_id: this.data.resourceMarieId,
            resource_type: "user",
            resource_roles: [this.data.roleTesterId],
            user_id: false,
            start_datetime: "2023-11-09 00:00:00",
            end_datetime: "2023-11-09 22:00:00",
        }, {
            display_name: "Planning Slot Pierre",
            resource_id: this.data.resourcePierreId,
            resource_type: "user",
            resource_roles: [this.data.roleITSpecialistId],
            user_id: this.data.user1Id,
            start_datetime: "2023-11-09 00:00:00",
            end_datetime: "2023-11-09 22:00:00",
        }]);

        // Mock RPC
        this.mockRPC = async (_, { args, method, model }) => {
            if (method === "gantt_resource_work_interval") {
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
                    },
                ];
            }
            if (method === "gantt_progress_bar" && model === "planning.slot" && args[0][0] === "resource_id") {
                return {
                    resource_id: {
                        1: {
                            value: 100,
                            max_value: 100,
                            is_material_resource: true,
                            resource_color: 1,
                            display_popover_material_resource: false,
                            employee_id: false,
                        },
                        2: {
                            value: 100,
                            max_value: 100,
                            is_material_resource: true,
                            resource_color: 1,
                            display_popover_material_resource: true,// Testing this full behavior would require a tour
                            employee_id: false,
                        },
                        3: {
                            value: 100,
                            max_value: 100,
                            is_material_resource: false,
                            resource_color: false,
                            display_popover_material_resource: false,
                            employee_id: 1,
                        },
                        4: {
                            value: 100,
                            max_value: 100,
                            is_material_resource: false,
                            resource_color: false,
                            display_popover_material_resource: false,
                            employee_id: 2,
                        },
                    },
                };

            }
        }
    },
}, () => {
    QUnit.test("many2one_avatar_resource widget in kanban view", async function (assert) {
        this.serverData.views = {
            "planning.slot,false,kanban": `
                    <kanban>
                        <templates>
                            <t t-name="kanban-box">
                                <div>
                                    <field name="display_name"/>
                                    <field name="resource_id" widget="many2one_avatar_resource"/>
                                </div>
                            </t>
                        </templates>
                    </kanban>`,
        };
        const { openView } = await start({ serverData: this.serverData });
        await openView({
            res_model: "planning.slot",
            views: [[false, "kanban"]],
        });

        assert.containsN(document.body, ".o_m2o_avatar", 4);

        // fa-wrench should be displayed for first two planning slots
        assert.containsN(
            document.body,
            ".o_m2o_avatar > span.o_material_resource > i.fa-wrench",
            2,
            "material icon should be displayed for the first two gantt rows (material resources)"
        );

        // Third and fourth slots should display employee avatar
        assert.containsN(
            document.body,
            ".o_field_many2one_avatar_resource img",
            2,
        );
        assert.strictEqual(
            document.querySelector(".o_kanban_record:nth-of-type(3) .o_field_many2one_avatar_resource img").getAttribute("data-src"),
            `/web/image/resource.resource/${this.data.resourceMarieId}/avatar_128`,
        );
        assert.strictEqual(
            document.querySelector(".o_kanban_record:nth-of-type(4) .o_field_many2one_avatar_resource img").getAttribute("data-src"),
            "/web/image/resource.resource/" + this.data.resourcePierreId + "/avatar_128",
        );

        // 1. Clicking on material resource's icon with only one role
        await click(document.querySelector(".o_kanban_record:nth-of-type(1) .o_m2o_avatar"));
        assert.containsNone(document.body, ".o_avatar_card");

        // 2. Clicking on material resource's icon with two roles
        await click(document.querySelector(".o_kanban_record:nth-of-type(2) .o_m2o_avatar"));
        await contains(".o_avatar_card");
        assert.containsNone(document.body, ".o_avatar_card .o_avatar > img"); // No avatar for material resource
        assert.containsNone(document.body, ".o_avatar_card_buttons button");
        assert.containsN(document.body, ".o_avatar_card .o_resource_roles_tags > .o_tag", 2); // Roles should be listed in the card

        // 3. Clicking on human resource's avatar with no user associated
        await click(document.querySelector(".o_kanban_record:nth-of-type(3) .o_m2o_avatar"));
        await contains(".o_card_user_infos span", { text: "Marie" });

        // 4. Clicking on human resource's avatar with one user associated
        await click(document.querySelector(".o_kanban_record:nth-of-type(4) .o_m2o_avatar"));
        await contains(".o_card_user_infos span", { text: "Pierre" });
    });

    QUnit.test("Employee avatar in Gantt view", async function (assert) {
        patchDate(2023, 10, 8, 8, 0, 0); // 10 --> November...
        this.serverData.views = {
            "planning.slot,false,gantt": `
                    <gantt js_class="planning_gantt" date_start="start_datetime" date_stop="end_datetime" progress_bar="resource_id"/>`,
        };
        const { openView } = await start({ serverData: this.serverData, mockRPC: this.mockRPC });
        await openView({
            res_model: "planning.slot",
            views: [[false, "gantt"]],
            context: { group_by: ["resource_id"] },
        });

        assert.containsN(
            document.body,
            ".o_gantt_row_title .o_avatar",
            4,
            
        );

        assert.containsN(
            document.body,
            ".o_avatar .o_material_resource .fa-wrench",
            2,
            "material icon should be displayed for the first two gantt rows (material resources)"
        );
        assert.containsN(
            document.body,
            ".o_gantt_row_title .o_avatar img",
            2,
            "avatar should be displayed for the third and fourth gantt rows (human resources)"
        );
        assert.strictEqual(
            document.querySelector(".o_gantt_row_title .o_avatar img").getAttribute("data-src"),
            `/web/image/resource.resource/${this.data.resourceMarieId}/avatar_128`,
            "avatar of the employee associated to the human resource should be displayed on third row",
        );
        assert.strictEqual(
            document.querySelectorAll(".o_gantt_row_title .o_avatar img")[1].getAttribute("data-src"),
            "/web/image/resource.resource/" + this.data.resourcePierreId + "/avatar_128",
            "avatar of the employee associated to the human resource should be displayed on fourth row",
        );

        // 1. Clicking on material resource's icon with only one role
        await click(document.querySelector(".o_avatar .o_material_resource .fa-wrench"));
        assert.containsNone(document.body, ".o_avatar_card");

        // 2. Clicking on material resource's icon with two roles
        await click(document.querySelectorAll(".o_avatar .o_material_resource .fa-wrench")[1]);
        await contains(".o_avatar_card");
        assert.containsNone(document.body, ".o_avatar_card .o_avatar > img"); // No avatar for material resource
        assert.containsNone(document.body, ".o_avatar_card_buttons button");
        assert.containsN(document.body, ".o_avatar_card .o_resource_roles_tags > .o_tag", 2); // Roles should be listed in the card

        // 3. Clicking on human resource's avatar with no user associated
        await click(document.querySelector(".o_gantt_row_title .o_avatar img"));
        await contains(".o_card_user_infos span", { text: "Marie" });
        await contains(".o_avatar_card", { count: 1 }, "Only one popover resource card should be opened at a time");

        // 4. Clicking on human resource's avatar with one user associated
        await click(document.querySelectorAll(".o_gantt_row_title .o_avatar img")[1]);
        await contains(".o_card_user_infos span", { text: "Pierre" });
        await contains(".o_avatar_card", { count: 1 }, "Only one popover resource card should be opened at a time");
    });
});
