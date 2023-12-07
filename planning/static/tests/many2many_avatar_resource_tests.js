/** @odoo-module **/

import { startServer } from "@bus/../tests/helpers/mock_python_environment";
import { start } from "@mail/../tests/helpers/test_utils";
import { contains } from "@web/../tests/utils";
import { setupViewRegistries } from "@web/../tests/views/helpers";
import { patchWithCleanup, click } from "@web/../tests/helpers/utils";
import { patchAvatarCardPopover } from "@hr/components/avatar_card/avatar_card_popover_patch";
import { patchAvatarCardResourcePopover } from "@planning/components/avatar_card_resource/avatar_card_resource_popover_patch";
import { AvatarCardPopover } from "@mail/discuss/web/avatar_card/avatar_card_popover";
import { AvatarCardResourcePopover } from "@resource_mail/components/avatar_card_resource/avatar_card_resource_popover";


QUnit.module("M2MAvatarResourceWidgetTests", {
    /* Main Goals of these tests:
        - Tests the change made in planning to avatar card preview for resource:
            - Roles appear as tags on the card
            - Card should be displayed for material resources with at least 2 roles
     */
    async beforeEach() {
        this.serverData = {};
        setupViewRegistries();
        patchWithCleanup(AvatarCardPopover.prototype, patchAvatarCardPopover);
        patchWithCleanup(AvatarCardResourcePopover.prototype, patchAvatarCardResourcePopover);

        /* 1. Create data
           4 type of resources will be tested in the widget:
            - material resource with only one role (resourceComputer1)
                - clicking the icon should not open any popover
            - material resource with two roles (resourceComputer2)
                - clicking the icon should open a card popover with resource name and roles
            - human resource not linked to a user (Marie)
                - a card popover should open including the roles of the employee
            - human resource linked to a user (Pierre)
                - a card popover should open including the roles of the employee
         */

        const pyEnv = await startServer();
        this.data = {};

        // Roles
        [this.data.roleTesterId, this.data.roleITSpecialistId] = pyEnv["planning.role"].create([{
            name: "Tester",
            color: 1,
        }, {
            name: "It Specialist",
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
        [this.data.employeeMarieId, this.data.employeePierreId] = pyEnv["hr.employee"].create([{
            name: "Marie",
            resource_id: this.data.resourceMarieId,
        }, {
            name: "Pierre",
            resource_id: this.data.resourcePierreId,
        }]);
        // Imitating the server behavior by creating an hr.employee.public record with the same data and same id
        [this.data.employeePublicMarieId, this.data.employeePublicPierreId] = pyEnv["hr.employee.public"].create([{
            name: "Marie",
        }, {
            name: "Pierre",
            user_id: this.data.userPierreId,
            user_partner_id: this.data.partnerPierreId,
        }]);

        // Task linked to those resources 
        this.data.task1Id = pyEnv["resource.task"].create({
            display_name: "Task with four resources",
            resource_ids: [
                this.data.resourceComputer1Id,
                this.data.resourceComputer2Id,
                this.data.resourceMarieId,
                this.data.resourcePierreId,
            ],
        });
    },
}, () => {
    QUnit.test("many2many_avatar_resource widget in form view", async function (assert) {
        this.serverData.views = {
            "resource.task,false,form": `<form string="Tasks">
                <field name="display_name"/>
                <field name="resource_ids" widget="many2many_avatar_resource"/>
            </form>`,
        };
        const { openView } = await start({ serverData: this.serverData });
        await openView({
            res_model: "resource.task",
            res_id: this.data.task1Id,
            views: [[false, "form"]],
        });

        assert.containsN(document.body, "img.o_m2m_avatar", 2);
        assert.containsN(document.body, ".fa-wrench", 2);

        // 1. Clicking on material resource's icon with only one role
        await click(document.querySelector(".many2many_tags_avatar_field_container .o_tag i.fa-wrench"));
        assert.containsNone(document.body, ".o_avatar_card");

        // 2. Clicking on material resource's icon with two roles
        await click(document.querySelectorAll(".many2many_tags_avatar_field_container .o_tag i.fa-wrench")[1]);
        await contains(".o_avatar_card");
        assert.containsNone(document.body, ".o_avatar_card .o_avatar > img"); // No avatar for material resource
        assert.containsNone(document.body, ".o_avatar_card_buttons button");
        assert.containsN(document.body, ".o_avatar_card .o_resource_roles_tags > .o_tag", 2); // Roles should be listed in the card

        // 3. Clicking on human resource's avatar with no user associated
        await click(document.querySelector(".many2many_tags_avatar_field_container .o_tag img"));
        await contains(".o_card_user_infos span", { text: "Marie" });
        await contains(".o_avatar_card", { count: 1 }, "Only one popover resource card should be opened at a time");

        // 4. Clicking on human resource's avatar with one user associated
        await click(document.querySelectorAll(".many2many_tags_avatar_field_container .o_tag img")[1]);
        await contains(".o_card_user_infos span", { text: "Pierre" });
        await contains(".o_avatar_card", { count: 1 }, "Only one popover resource card should be opened at a time");
    });
});
