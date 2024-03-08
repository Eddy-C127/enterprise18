import { beforeEach, describe, expect, test } from "@odoo/hoot";
import { animationFrame, mockDate } from "@odoo/hoot-mock";
import { defineModels, fields, models, mountWithCleanup, onRpc, patchWithCleanup } from "@web/../tests/web_test_helpers";
import { clickCell, mountGanttView} from "@web_gantt/../tests/web_gantt_test_helpers";

import { Domain } from "@web/core/domain";
import { PlanningGanttRenderer } from "@planning/views/planning_gantt/planning_gantt_renderer";
import { SelectCreateDialog } from "@web/views/view_dialogs/select_create_dialog";
import { View } from "@web/views/view";
import { Component, onWillStart, useState, xml } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

describe.current.tags("desktop");

class PlanningSlot extends models.Model {
    _name = "planning.slot";

    role_id = fields.Many2one({ relation: "planning.role" });
    sale_line_id = fields.Many2one({ string: "Sale Order Item", relation: "sale.order.line" });
    resource_id = fields.Many2one({ string: "Resource", relation: "resource.resource" });
    start_datetime = fields.Datetime({ string: "Start Datetime" });
    end_datetime = fields.Datetime({ string: "End Datetime"});
    allocated_percentage = fields.Float({ string: "Allocated percentage" });

    _records = [
        {
            id: 1,
            role_id: 1,
            sale_line_id: 1,
            resource_id: false,
            start_datetime: "2021-10-12 08:00:00",
            end_datetime: "2021-10-12 12:00:00",
            allocated_percentage: 0.5,
        },
    ];
}

class PlanningRole extends models.Model {
    _name = "planning.role";

    name = fields.Char();

    _records = [
        { "id": 1, name: "Developer" },
        { "id": 2, name: "Support Tech" },
    ];
}

class Resource extends models.Model {
    _name = "resource.resource";
}

class SaleOrderLine extends models.Model {
    _name = "sale.order.line";
    
    name = fields.Char();

    _records = [
        { id: 1, name: "Computer Configuration" },
    ]
}

defineModels([PlanningSlot, PlanningRole, Resource, SaleOrderLine]);

beforeEach(() => {
    mockDate("2021-10-10 07:00:00", +1);
    onRpc("has_group", () => false);
});

test("Process domain for plan dialog", async function () {
    let renderer;
    patchWithCleanup(PlanningGanttRenderer.prototype, {
        setup() {
            super.setup(...arguments);
            renderer = this;
        }
    });

    onRpc("gantt_resource_work_interval", () => [{ false: [["2021-10-12 08:00:00", "2022-10-12 12:00:00"]] }]);

    class Parent extends Component {
        static template = xml`<View t-props="state"/>`;
        static components = { View };
        static props = ["*"];
        setup() {
            this.state = useState({
                arch: `<gantt js_class="planning_gantt" date_start="start_datetime" date_stop="end_datetime" default_scale="week"/>`,
                resModel: "planning.slot",
                type: "gantt",
                domain: [["start_datetime", "!=", false], ["end_datetime", "!=", false]],
            });
            this.field = useService("field");
            onWillStart(async () => {
                this.state.fields = await this.field.loadFields("planning.slot");
            });
        }
    }

    const parent = await mountWithCleanup(Parent);
    await animationFrame();

    let expectedDomain = Domain.and([
        Domain.and([
            new Domain(["&", ...Domain.TRUE.toList({}), ...Domain.TRUE.toList({})]),
            ["|", ["start_datetime", "=", false], ["end_datetime", "=", false]],
        ]),
        [["sale_line_id.state", "!=", "cancel"]],
        [["sale_line_id", "!=", false]],
    ]);
    expect(renderer.getPlanDialogDomain()).toEqual(expectedDomain.toList());

    parent.state.domain = ["|", ["role_id", "=", false], "&", ["resource_id", "!=", false], ["start_datetime", "=", false]];
    await animationFrame();

    expectedDomain = Domain.and([
        Domain.and([
            new Domain([
                "|", ["role_id", "=", false],
                    "&", ["resource_id", "!=", false], ...Domain.TRUE.toList({}),
            ]),
            ["|", ["start_datetime", "=", false], ["end_datetime", "=", false]],
        ]),
        [["sale_line_id.state", "!=", "cancel"]],
        [["sale_line_id", "!=", false]],
    ]);
    expect(renderer.getPlanDialogDomain()).toEqual(expectedDomain.toList());

    parent.state.domain = ["|", ["start_datetime", "=", false], ["end_datetime", "=", false]];
    await animationFrame();

    expectedDomain = Domain.and([
        Domain.and([
            Domain.TRUE,
            ["|", ["start_datetime", "=", false], ["end_datetime", "=", false]],
        ]),
        [["sale_line_id.state", "!=", "cancel"]],
        [["sale_line_id", "!=", false]],
    ]);
    expect(renderer.getPlanDialogDomain()).toEqual(expectedDomain.toList());
});

test("check default planned dates on the plan dialog", async function () {
    expect.assertions(4);
    patchWithCleanup(SelectCreateDialog.prototype, {
        setup() {
            super.setup(...arguments);
            expect(this.props.context.default_start_datetime).toMatch(/^2021-10-11/);
            expect(this.props.context.default_end_datetime).toMatch(/^2021-10-11/);
            expect(this.props.context.focus_date).toMatch(/^2021-10-13/);
            expect(this.props.context.scale).toBe("week");
        },
    });

    PlanningSlot._records.push({
        id: 2,
        role_id: 1,
        sale_line_id: 1,
        resource_id: false,
        start_datetime: false,
        end_datetime: false,
    });
    PlanningSlot._views = { list: `<list/>` };

    onRpc("gantt_resource_work_interval", () => []);

    await mountGanttView({
        resModel: "planning.slot",
        arch: `<gantt js_class="planning_gantt" date_start="start_datetime" date_stop="end_datetime" default_scale="week"/>`,
    });
    await clickCell("11 W41 2021");
});
