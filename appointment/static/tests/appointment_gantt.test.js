import { describe, expect, test } from "@odoo/hoot";

import { mockDate } from "@odoo/hoot-mock";
import { onRpc } from "@web/../tests/web_test_helpers";

import {
    dragPill,
    getGridContent,
    mountGanttView,
} from "@web_gantt/../tests/web_gantt_test_helpers";
import { CalendarEvent, defineAppointmentModels } from "./appointment_tests_common";

describe.current.tags("desktop");

defineAppointmentModels();

// minimalist version of the appointment gantt view
const ganttViewArch = `
    <gantt date_start="start" date_stop="stop" js_class="appointment_booking_gantt"
           default_group_by="partner_ids">

        <field name="appointment_attended"/>
        <field name="appointment_type_id"/>
        <field name="partner_id"/>
        <field name="partner_ids"/>
        <field name="resource_ids"/>
        <field name="user_id"/>

        <templates>
            <div t-name="gantt-popover">
                <ul>
                    <li>Name: <t t-out="gantt_pill_contact_name"/></li>
                    <li>Phone: <t t-out="gantt_pill_contact_phone"/></li>
                    <li>Email: <t t-out="gantt_pill_contact_email"/></li>
                </ul>
            </div>
        </templates>

    </gantt>`;

test("empty default group gantt rendering", async () => {
    expect.assertions(18);
    mockDate("2022-01-03 08:00:00");
    CalendarEvent._records[0].appointment_type_id = 1;
    CalendarEvent._records[1].appointment_type_id = 1;
    CalendarEvent._records[2].appointment_type_id = 1;
    const partners = ["Partner 1", "Partner 214", "Partner 216"];
    const partnerEvents = [
        ["Event 3", "Event 1"],
        ["Event 2", "Event 3", "Event 1"],
        ["Event 2", "Event 3"],
    ];
    onRpc((args) => {
        if (
            args.model === "calendar.event" &&
            args.method === "write" &&
            args.args[0][0] === 2 &&
            "partner_ids" in args.args[1]
        ) {
            const methodArgs = args.args[1];
            expect(methodArgs.start).toBe("2022-01-21 22:00:00");
            expect(methodArgs.stop).toBe("2022-01-21 23:00:00");
            const [unlinkCommand, linkCommand] = methodArgs.partner_ids;
            expect(unlinkCommand[0]).toBe(3);
            expect(unlinkCommand[1]).toBe(214);
            expect(linkCommand[0]).toBe(4);
            expect(linkCommand[1]).toBe(100);

            expect.step("write partners and date");
        } else if (
            args.model === "calendar.event" &&
            args.method === "write" &&
            args.args[0][0] === 2 &&
            "user_id" in args.args[1]
        ) {
            expect(args.args[1].user_id).toBe(100);

            expect.step("write user id");
        } else if (args.model === "calendar.event" && args.method === "get_gantt_data") {
            expect.step("get_gantt_data");
        }
    });
    await mountGanttView({ resModel: "calendar.event", arch: ganttViewArch });
    const { rows } = getGridContent();
    for (let pid = 0; pid < partners.length; pid++) {
        expect(rows[pid].title).toBe(partners[pid]);
        for (let eid = 0; eid < partnerEvents[pid].length; eid++) {
            expect(rows[pid].pills[eid].title).toBe(partnerEvents[pid][eid]);
        }
    }
    const { drop } = await dragPill("Event 2", { nth: 1 });
    await drop({ row: "Partner 1", column: "21 January 2022", part: 2 });
    expect([
        "get_gantt_data",
        "write partners and date",
        "write user id",
        "get_gantt_data",
    ]).toVerifySteps();
});

test("'Add Closing Days' button rendering - 1", async () => {
    onRpc("has_group", ({ args }) => {
        if (args[1] === "appointment.group_appointment_manager") {
            return true;
        }
    });
    await mountGanttView({
        resModel: "calendar.event",
        arch: ganttViewArch,
        groupBy: ["resource_ids"],
    });
    expect(".o_appointment_booking_gantt_button_add_leaves").toHaveCount(1, {
        message: "the button should have been rendered",
    });
});


test("'Add Closing Days' button rendering - 2", async () => {
    onRpc("has_group", ({ args }) => {
        if (args[1] === "appointment.group_appointment_manager") {
            return false;
        }
    });
    await mountGanttView({
        resModel: "calendar.event",
        arch: ganttViewArch,
        groupBy: ["resource_ids"],
    });
    expect(".o_appointment_booking_gantt_button_add_leaves").toHaveCount(0, {
        message: "the button should not have been rendered: the user is not an appointment manager",
    });
});


test("'Add Closing Days' button rendering - 3", async () => {
    onRpc("has_group", ({ args }) => {
        if (args[1] === "appointment.group_appointment_manager") {
            return true;
        }
    });
    await mountGanttView({
        resModel: "calendar.event",
        arch: ganttViewArch,
        groupBy: ["partner_ids"],
    });
    expect(".o_appointment_booking_gantt_button_add_leaves").toHaveCount(0, {
        message: "the button should not have been rendered: not grouped by 'resource_ids'",
    });
});
