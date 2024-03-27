import { beforeEach, describe, test, expect } from "@odoo/hoot";
import { onRpc } from "@web/../tests/web_test_helpers";
import {
    contains,
    openKanbanView,
    openView,
    openListView,
    registerArchs,
    start,
    startServer,
} from "@mail/../tests/mail_test_helpers";
import { defineHelpdeskModels } from "@helpdesk/../tests/helpdesk_test_helpers";

describe.current.tags("desktop");
defineHelpdeskModels();

beforeEach(async () => {
    const pyEnv = await startServer();
    const [stageId_1, stageId_2] = pyEnv["helpdesk.stage"].create([
        { name: "Stage 1" },
        { name: "Stage 2" },
        { name: "Stage 3" },
    ]);
    const teamId = pyEnv["helpdesk.team"].create({ name: "Team 1" });
    pyEnv["helpdesk.ticket"].create([
        { name: "My ticket", team_id: teamId, stage_id: stageId_1, priority: "0" },
        { name: "Ticket 2", team_id: teamId, stage_id: stageId_1, priority: "0" },
        { name: "Ticket 3", team_id: teamId, stage_id: stageId_2, priority: "0" },
    ]);
    registerArchs({
        "helpdesk.ticket,false,kanban": `
            <kanban default_group_by="stage_id" js_class="helpdesk_ticket_kanban">
                <field name="stage_id"/>
                <templates>
                    <t t-name="kanban-box">
                        <div>
                            <field name="name"/>
                            <field name="sla_deadline"/>
                        </div>
                    </t>
                </templates>
            </kanban>
        `,
        "helpdesk.ticket,false,graph": `<graph/>`,
        "helpdesk.ticket,false,search": `<search/>`,
    });
});

test("Test group label for empty SLA Deadline in tree", async () => {
    registerArchs({
        "helpdesk.ticket,false,list": `<tree js_class="helpdesk_ticket_list">
                <field name="sla_deadline" widget="remaining_days"/>
                <field name="name" />
            </tree>`,
        "helpdesk.ticket,false,search": `<search/>`,
    });
    await start();
    await openListView("helpdesk.ticket", { context: { group_by: ["sla_deadline"] } });
    await contains(".o_group_name", { text: "Deadline reached (3)" });
});

test("Test group label for empty SLA Deadline in kanban", async () => {
    await start();
    await openKanbanView("helpdesk.ticket", {
        arch: `<kanban js_class="helpdesk_ticket_kanban" default_group_by="sla_deadline">
            <templates>
                <t t-name="kanban-box"/>
            </templates>
        </kanban>`,
    });
    await contains(".o_column_title", { text: "Deadline reached" });
});

test("Cannot create group if we are not in tickets of specific helpdesk team", async () => {
    await start();
    await openKanbanView("helpdesk.ticket");
    await contains(".o_kanban_group", { count: 2 });
    await contains(".o_column_quick_create", { count: 0 });
});

test("Test group label for empty SLA Deadline in pivot", async () => {
    await start();
    await openView({
        res_model: "helpdesk.ticket",
        views: [[false, "pivot"]],
        arch: `<pivot js_class="helpdesk_ticket_pivot">
                <field name="sla_deadline" type="row"/>
            </pivot>`,
    });
    await contains("tr:nth-of-type(2) .o_pivot_header_cell_closed", { text: "Deadline reached" });
});

test("Prevent helpdesk users from reordering ticket stages", async () => {
    await start();
    onRpc("has_group", (group) => group === "helpdesk.group_helpdesk_user");
    await openKanbanView("helpdesk.ticket", {
        arch: `<kanban default_group_by="stage_id" js_class="helpdesk_ticket_kanban">
            <templates>
                <t t-name="kanban-box">
                    <div>
                        <field name="name"/>
                    </div>
                </t>
            </templates>
        </kanban>`,
    });
    expect(".o_group_draggable").toHaveCount(0);
});

test("Access for helpdesk manager to reordering ticket stages", async () => {
    await start();
    await openKanbanView("helpdesk.ticket", {
        arch: `<kanban default_group_by="stage_id" js_class="helpdesk_ticket_kanban">
            <templates>
                <t t-name="kanban-box">
                    <div>
                        <field name="name"/>
                    </div>
                </t>
            </templates>
        </kanban>`,
    });
    expect(".o_group_draggable").toHaveCount(2);
});
