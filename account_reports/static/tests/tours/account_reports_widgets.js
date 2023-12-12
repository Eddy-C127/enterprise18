import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add("account_reports_widgets", {
    test: true,
    url: "/web?#action=account_reports.action_account_report_pl",
    steps: () => [
        {
            content: "change date filter",
            trigger: "#filter_date button",
            run: "click",
        },
        {
            content: "change date filter",
            trigger: ".dropdown-menu span:contains('Last Financial Year')",
            run: "click",
        },
        {
            content: "wait refresh",
            trigger: "#filter_date button:contains('2019')",
        },
        {
            content: "change comparison filter",
            trigger: "#filter_comparison .btn:first()",
            run: "click",
        },
        {
            content: "change comparison filter",
            trigger: ".dropdown-item.period:first()",
            run: "click",
        },
        {
            content: "Apply filter by closing the dropdown",
            trigger: "#filter_comparison .btn:first()",
            run: "click",
        },
        {
            content: "wait refresh, report should have 4 columns",
            trigger: "th + th + th + th",
            run: () => {},
        },
        {
            title: "open dropdown",
            trigger: ".o_control_panel_main_buttons .dropdown-toggle",
            run: "click",
        },
        {
            title: "export xlsx",
            trigger: "button:contains('XLSX')",
            run: "click",
        },
    ],
});
