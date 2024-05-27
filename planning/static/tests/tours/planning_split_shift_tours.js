/** @odoo-module **/

import * as hoot from "@odoo/hoot-dom";
import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add('planning_split_shift_week', {
    url: '/web?debug=tests',
    test: true,
    steps: () => [{
    trigger: '.o_app[data-menu-xmlid="planning.planning_menu_root"]',
    content: "Let's start managing your employees' schedule!",
    position: 'bottom',
    run: "click",
}, {
    trigger: 'input[type="range"]',
    content: "The initial default scale should be week (1)",
    run() {
        const subjectValue = document.querySelector('input[type="range"]').value;
        if (subjectValue !== "1") {
            console.error(
                `Default scale should be week (1) (actual: ${subjectValue})`
            );
        }
    },
},{
    trigger: ".o_searchview_dropdown_toggler",
    content: "Open Filter",
    run: "click",
}, {
    trigger: ".o_add_custom_filter",
    content: "Click on custom filter",
    run: "click",
}, {
    trigger: ".o_model_field_selector",
    content: "Write domain excluding open shifts",
    run() {
        const input = document.querySelector(".o_domain_selector_debug_container textarea")
        input.value = '[("resource_id", "!=", False)]';
        input.dispatchEvent(new Event("change", { bubbles: true, cancelable: false }));
    }
}, {
    trigger: ".modal-footer > .btn-primary",
    content: "Add custom filter",
    run: "click",
}, {
    trigger: ".o_searchview_input",
    content: "Search planning shifts assigned to Aramis",
    run: "fill Aramis",
}, {
    trigger: ".o_menu_item.dropdown-item > a:not(.o_expand)",
    content: "Select filter resource = Aramis",
    run: 'click',
}, {
    trigger: ".o_searchview_input",
    content: "Search planning shifts assigned to Athos",
    run: "fill Athos",
}, {
    trigger: ".o_menu_item.dropdown-item > a:not(.o_expand)",
    content: "Select filter resource = Athos",
    run: 'click',
}, {
    trigger: ".o_searchview_input",
    content: "Search planning shifts assigned to Porthos",
    run: "fill Porthos",
}, {
    trigger: ".o_menu_item.dropdown-item > a:not(.o_expand)",
    content: "Select filter resource = Porthos",
    run: 'click',
}, {
    trigger: ".o_gantt_picker:first",
    content: "Open start date picker",
    run: 'click',
}, {
    trigger: ".o_popover .o_datetime_picker",
    content: "Select first day of the current week",
    run: (helpers) => {
        const firstDayOfCurrentWeek = hoot.queryLast(".o_week_number_cell + .o_date_item_cell:has(~ .o_today)", { root: helpers.anchor });
        hoot.click(firstDayOfCurrentWeek);
    },
}, {
    trigger: ".o_gantt_picker:last",
    content: "Open stop date picker",
    run: 'click',
}, {
    trigger: ".o_popover .o_datetime_picker",
    content: "Select last day of the current week",
    run: async (helpers) => {
        const oToday = hoot.queryFirst(".o_today", { root: helpers.anchor });
        if (!oToday) {
            hoot.click(".o_popover .o_previous", { root: helpers.anchor });
            await hoot.waitFor(".o_today", { root: helpers.anchor });
        }
        const nextWeekNumber = hoot.queryFirst(".o_today ~ .o_week_number_cell", { root: helpers.anchor });
        if (nextWeekNumber) {
            const lastDayOfCurrentWeek = nextWeekNumber.previousElementSibling;
            hoot.click(lastDayOfCurrentWeek);
        } else {
            const lastDay = hoot.queryLast(".o_date_item_cell", { root: helpers.anchor });
            hoot.click(lastDay);
        }

        // Await for the view to only display one week to ensure recurring pills are not rendered
        await hoot.waitUntil(() => hoot.queryAll(".o_gantt_header_title").length === 1, { timeout: 5000 });
    },
}, {
    trigger: ".o_gantt_pill_split_tool[data-split-tool-pill-id='__pill__1_0']",
    content: "Split the slot assigned to Aramis after one day",
    run: 'click',
}, {
    trigger: ".o_gantt_pill_wrapper[data-pill-id='__pill__4']",
    content: "Wait for the new shift to appear",
    run() {},
}, {
    trigger: ".o_gantt_pill_split_tool[data-split-tool-pill-id='__pill__3_1']",
    content: "Split the slot assigned to Athos after two days",
    run: 'click',
}, {
    trigger: ".o_gantt_pill_wrapper[data-pill-id='__pill__5']",
    content: "Wait for the new shift to appear",
    run() {},
}, {
    trigger: ".o_gantt_pill_split_tool[data-split-tool-pill-id='__pill__3_0']",
    content: "Split the first slot assigned to Athos after one day",
    run: 'click',
}, {
    trigger: ".o_gantt_pill_wrapper[data-pill-id='__pill__6']",
    content: "Wait for the new shift to appear",
    run() {},
}, {
    trigger: ".o_gantt_pill_split_tool[data-split-tool-pill-id='__pill__6_0']",
    content: "Split the first slot assigned to Porthos after one day",
    run: 'click',
}, {
    trigger: ".o_gantt_pill_wrapper[data-pill-id='__pill__7']",
    content: "Wait for the new shift to appear",
    run() {},
}]});
