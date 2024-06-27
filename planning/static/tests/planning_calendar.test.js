import { expect, test, beforeEach, describe } from "@odoo/hoot";
import { click, queryText, queryFirst } from "@odoo/hoot-dom";
import { animationFrame, mockDate } from "@odoo/hoot-mock";

import {
    onRpc,
    mountWithCleanup,
    getService,
    patchWithCleanup,
    defineActions,
} from "@web/../tests/web_test_helpers";
import { WebClient } from "@web/webclient/webclient";
import { resizeEventToTime, clickEvent } from "@web/../tests/views/calendar/calendar_test_helpers";

import {
    definePlanningModels,
    planningModels,
    ResourceResource,
    PlanningRole,
} from "./planning_mock_models";

describe.current.tags("desktop");

class PlanningSlot extends planningModels.PlanningSlot {
    _views = {
        calendar: `<calendar class="o_planning_calendar_test"
                        event_open_popup="true"
                        date_start="start_datetime"
                        date_stop="end_datetime"
                        color="color"
                        mode="week"
                        js_class="planning_calendar">
                            <field name="resource_id" />
                            <field name="role_id" filters="1" color="color"/>
                            <field name="state"/>
                            <field name="repeat"/>
                            <field name="recurrence_update"/>
                            <field name="end_datetime"/>
                    </calendar>`,
        list: `<list js_class="planning_tree"><field name="resource_id"/></list>`,
        search: `<search/>`,
    };
}

planningModels.PlanningSlot = PlanningSlot;

definePlanningModels();
defineActions([
    {
        id: 1,
        name: "planning action",
        res_model: "planning.slot",
        type: "ir.actions.act_window",
        views: [
            [false, "calendar"],
            [false, "list"],
        ],
    },
]);

beforeEach(() => {
    PlanningSlot._records = [
        {
            id: 1,
            name: "First Record",
            start_datetime: "2019-03-11 08:00:00",
            end_datetime: "2019-03-11 12:00:00",
            resource_id: 1,
            color: 7,
            role_id: 1,
            state: "draft",
            repeat: true,
        },
        {
            id: 2,
            name: "Second Record",
            start_datetime: "2019-03-13 08:00:00",
            end_datetime: "2019-03-13 12:00:00",
            resource_id: 2,
            color: 9,
            role_id: 2,
            state: "published",
        },
    ];
    ResourceResource._records = [
        { id: 1, name: "Chaganlal" },
        { id: 2, name: "Maganlal" },
    ];
    PlanningRole._records = [
        { id: 1, name: "JavaScript Developer", color: 1 },
        { id: 2, name: "Functional Consultant", color: 2 },
    ];

    onRpc("check_access_rights", () => {
        return true;
    });

    mockDate("2019-03-13 00:00:00", +1);
});

test("planning calendar view: copy previous week", async () => {
    onRpc("action_copy_previous_week", () => {
        expect.step("copy_previous_week()");
        return {};
    });
    await mountWithCleanup(WebClient);
    await getService("action").doAction(1);
    patchWithCleanup(getService("action"), {
        async doAction(action) {
            expect(action).toBe("planning.planning_send_action", {
                message: "should open 'Send Planning By Email' form view",
            });
        },
    });

    click(".o_control_panel_main_buttons .o_button_copy_previous_week");
    await animationFrame();
    expect(["copy_previous_week()"]).toVerifySteps({
        message: "verify action_copy_previous_week() invoked.",
    });

    // deselect "Maganlal" from Assigned to
    click(".o_calendar_filter_item[data-value='2'] > input");
    await animationFrame();
    expect(".fc-event", 1, "should display 1 events on the week").toHaveCount(1, {
        message: "should display 1 events on the week",
    });
    click(".o_control_panel_main_buttons .o_button_send_all");
    await animationFrame();

    // Switch the view and verify the notification
    expect(".o_notification_body").toHaveCount(1);
    click(".o_switch_view.o_list");
    await animationFrame();
    expect(".o_action_manager").not.toHaveClass("o_notification_body");
});

test("Resize or Drag-Drop should open recurrence update wizard", async () => {
    await mountWithCleanup(WebClient);
    await getService("action").doAction(1);

    // Change the time of the repeat and normal pills
    await resizeEventToTime(1, "2019-03-11 14:30:00");
    await resizeEventToTime(2, "2019-03-13 14:30:00");

    // In recurrence update wizard -> Select "This shift" and confirm
    click(queryFirst(".modal-content .btn-primary"));
    await animationFrame();

    // Open popover of the repeat pill
    await clickEvent(1);
    expect(".o_cw_popover").toHaveCount(1, { message: "should open a popover clicking on event" });
    expect(
        queryText(
            ".o_cw_popover .o_cw_popover_fields_secondary .list-group-item .o_field_datetime"
        ).split(" ")[1]
    ).toBe("14:30:00", {
        message: "should have correct start date",
    });

    // Open popover of the normal pill
    await clickEvent(2);
    expect(".o_cw_popover").toHaveCount(1, { message: "should open a popover clicking on event" });
    expect(
        queryText(
            ".o_cw_popover .o_cw_popover_fields_secondary .list-group-item .o_field_datetime"
        ).split(" ")[1]
    ).toBe("14:30:00", {
        message: "should have correct start date",
    });
});
