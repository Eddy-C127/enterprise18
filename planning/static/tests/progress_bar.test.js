import { defineMailModels } from "@mail/../tests/mail_test_helpers";
import { mountWithCleanup } from "@web/../tests/web_test_helpers";
import { PlanningEmployeeAvatar } from "@planning/views/planning_gantt/planning_employee_avatar";
import { queryLast } from "@odoo/hoot-dom";
import { test, expect } from "@odoo/hoot";

defineMailModels();

test("ProgressBar: Default role of material resources should be in muted.", async () => {
    await mountWithCleanup(PlanningEmployeeAvatar, {
        props: {
            resId: 1,
            resModel: "It'sAMe",
            displayName: "SuperMarioOnThePs4 (WAHOO)",
        },
    });
    expect(queryLast("span")).toHaveClass("text-muted");
});
