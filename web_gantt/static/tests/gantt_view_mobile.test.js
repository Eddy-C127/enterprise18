import { beforeEach, describe, expect, test } from "@odoo/hoot";
import { queryAll, queryAllTexts, queryFirst } from "@odoo/hoot-dom";
import {
    contains,
    defineModels,
    fields,
    getService,
    models,
    mountView,
    mountWithCleanup,
    onRpc,
    patchDate,
} from "@web/../tests/web_test_helpers";
import { CLASSES, SELECTORS } from "./gantt_test_helpers";

import { WebClient } from "@web/webclient/webclient";
class Tasks extends models.Model {
    start = fields.Datetime({ string: "Start Date" });
    stop = fields.Datetime({ string: "Stop Date" });
    user_id = fields.Many2one({ string: "Assign to", relation: "users" });

    _records = [
        {
            id: 1,
            start: "2018-11-30 18:30:00",
            stop: "2018-12-31 18:29:59",
            user_id: 1,
        },
        {
            id: 2,
            start: "2018-12-17 11:30:00",
            stop: "2018-12-22 06:29:59",
            user_id: 2,
        },
        {
            id: 3,
            start: "2018-12-27 06:30:00",
            stop: "2019-01-03 06:29:59",
            user_id: 2,
        },
        {
            id: 4,
            start: "2018-12-19 22:30:00",
            stop: "2018-12-20 06:29:59",
            user_id: 1,
        },
        {
            id: 5,
            start: "2018-11-08 01:53:10",
            stop: "2018-12-04 01:34:34",
            user_id: 1,
        },
    ];
}

class Users extends models.Model {
    name = fields.Char();

    _records = [
        { id: 1, name: "User 1" },
        { id: 2, name: "User 2" },
    ];
}

defineModels([Tasks, Users]);

describe.current.tags("mobile");

beforeEach(() => {
    patchDate("2018-12-20T08:00:00", +1);
});

test("Progressbar: check the progressbar percentage visibility.", async () => {
    onRpc("gantt_progress_bar", (_, { model, args }) => {
        expect.step("gantt_progress_bar");
        expect(model).toBe("tasks");
        expect(args[0]).toEqual(["user_id"]);
        expect(args[1]).toEqual({ user_id: [1, 2] });
        return {
            user_id: {
                1: { value: 50, max_value: 100 },
                2: { value: 25, max_value: 200 },
            },
        };
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `
            <gantt date_start="start" date_stop="stop" default_scale="week" scales="week" default_group_by="user_id" progress_bar="user_id">
                <field name="user_id"/>
            </gantt>
        `,
    });
    expect(["gantt_progress_bar"]).toVerifySteps();

    expect(SELECTORS.progressBar).toHaveCount(2);
    const [progressBar1, progressBar2] = queryAll(SELECTORS.progressBar);
    expect(progressBar1).toHaveClass("o_gantt_group_success");
    expect(progressBar2).toHaveClass("o_gantt_group_success");
    const [rowHeader1, rowHeader2] = [progressBar1.parentElement, progressBar2.parentElement];
    expect(rowHeader1.matches(SELECTORS.rowHeader)).toBeTruthy();
    expect(rowHeader2.matches(SELECTORS.rowHeader)).toBeTruthy();
    expect(rowHeader1).not.toHaveClass(CLASSES.group);
    expect(rowHeader2).not.toHaveClass(CLASSES.group);
    expect(queryAll(SELECTORS.progressBarBackground).map((el) => el.style.width)).toEqual([
        "50%",
        "12.5%",
    ]);
    expect(SELECTORS.progressBarForeground).toHaveCount(2);
    expect(queryAllTexts(SELECTORS.progressBarForeground)).toEqual(["50h / 100h", "25h / 200h"]);

    // Check the style of one of the progress bars
    expect(rowHeader1.children.length).toBe(2);
    const rowTitle1 = rowHeader1.children[0];
    expect(rowTitle1.matches(SELECTORS.rowTitle)).toBeTruthy();
    expect(rowTitle1.nextElementSibling).toBe(progressBar1);

    expect(rowHeader1).toHaveStyle({ gridTemplateRows: "36px 35px" });
    expect(rowTitle1).toHaveStyle({ height: "36px" });
    expect(progressBar1).toHaveStyle({ height: "35px" });
});

test("Progressbar: grouped row", async () => {
    // Here the view is grouped twice on the same field.
    // This is not a common use case, but it is possible to achieve it
    // bu saving a default favorite with a groupby then apply it twice
    // on the same field through the groupby menu.
    // In this case, the progress bar should be displayed only once,
    // on the first level of grouping.
    onRpc("gantt_progress_bar", (_, { model, args }) => {
        expect.step("gantt_progress_bar");
        expect(model).toBe("tasks");
        expect(args[0]).toEqual(["user_id"]);
        expect(args[1]).toEqual({ user_id: [1, 2] });
        return {
            user_id: {
                1: { value: 50, max_value: 100 },
                2: { value: 25, max_value: 200 },
            },
        };
    });
    await mountView({
        resModel: "tasks",
        type: "gantt",
        arch: `
            <gantt date_start="start" date_stop="stop" default_scale="week" scales="week" default_group_by="user_id,user_id" progress_bar="user_id">
                <field name="user_id"/>
            </gantt>
        `,
    });
    expect(["gantt_progress_bar"]).toVerifySteps();

    expect(SELECTORS.progressBar).toHaveCount(2);
    const [progressBar1, progressBar2] = queryAll(SELECTORS.progressBar);
    expect(progressBar1).toHaveClass("o_gantt_group_success");
    expect(progressBar2).toHaveClass("o_gantt_group_success");
    const [rowHeader1, rowHeader2] = [progressBar1.parentElement, progressBar2.parentElement];
    expect(rowHeader1.matches(SELECTORS.rowHeader)).toBeTruthy();
    expect(rowHeader2.matches(SELECTORS.rowHeader)).toBeTruthy();
    expect(rowHeader1).toHaveClass(CLASSES.group);
    expect(rowHeader2).toHaveClass(CLASSES.group);
    expect(queryAll(SELECTORS.progressBarBackground).map((el) => el.style.width)).toEqual([
        "50%",
        "12.5%",
    ]);
    expect(SELECTORS.progressBarForeground).toHaveCount(2);
    expect(queryAllTexts(SELECTORS.progressBarForeground)).toEqual(["50h / 100h", "25h / 200h"]);

    // Check the style of one of the progress bars
    expect(rowHeader1.children.length).toBe(2);
    const rowTitle1 = rowHeader1.children[0];
    expect(rowTitle1.matches(SELECTORS.rowTitle)).toBeTruthy();
    expect(rowTitle1.nextElementSibling).toBe(progressBar1);

    expect(rowHeader1).toHaveStyle({ gridTemplateRows: "24px 35px" });
    expect(rowTitle1).toHaveStyle({ height: "24px" });
    expect(progressBar1).toHaveStyle({ height: "35px" });
});

test("horizontal scroll applies to the content [SMALL SCREEN]", async () => {
    Tasks._views.search = `<search/>`;
    Tasks._views.gantt = `<gantt date_start="start" date_stop="stop"><field name="user_id"/></gantt>`;
    await mountWithCleanup(WebClient);
    await getService("action").doAction({
        res_model: "tasks",
        type: "ir.actions.act_window",
        views: [[false, "gantt"]],
    });

    const o_view_controller = queryFirst(".o_view_controller");
    const o_content = queryFirst(".o_content");
    const firstHeaderCell = queryFirst(SELECTORS.headerCell);
    const initialXHeaderCell = firstHeaderCell.getBoundingClientRect().x;

    expect(o_view_controller).toHaveClass("o_action_delegate_scroll");
    expect(o_view_controller).toHaveStyle({ overflow: "hidden" });
    expect(o_content).toHaveStyle({ overflow: "auto" });
    expect(o_content).toHaveProperty("scrollLeft", 0);

    // Horizontal scroll
    await contains(".o_content").scroll({ left: 100 });

    expect(o_content).toHaveProperty("scrollLeft", 100);
    expect(firstHeaderCell.getBoundingClientRect().x).toBe(initialXHeaderCell - 100);
});
