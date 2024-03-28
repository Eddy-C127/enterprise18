/** @odoo-module **/

import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

registry.category("web_tour.tours").add('hr_payroll_edit_payslip_lines_tour', {
    test: true,
    url: '/web',
    steps: () => [
    stepUtils.showAppsMenuItem(),
    {
        content: "Open Payroll app",
        trigger: '.o_app[data-menu-xmlid="hr_work_entry_contract_enterprise.menu_hr_payroll_root"]',
    },
    {
        content: "Click Payslips",
        trigger: '[data-menu-xmlid="hr_payroll.menu_hr_payroll_payslips"]',
    },
    {
        content: "Click All Payroll",
        trigger: '[data-menu-xmlid="hr_payroll.menu_hr_payroll_employee_payslips"]',
    },
    {
        content: 'Remove "Batch" filter',
        trigger: ".o_searchview .o_facet_remove",
    },
    {
        content: "Click on payslip",
        trigger: '.o_data_row td:contains("Richard")',
    },
    {
        content: "Click on action",
        trigger: ".o_control_panel .o_cp_action_menus .dropdown-toggle",
    },
    {
        content: "Click on Edit Payslip Lines",
        trigger: 'span:contains("Edit Payslip Lines")',
    },
    {
        content: "Click payslip line",
        trigger: '.o_field_widget[name=line_ids] td.o_data_cell:contains("1,234.00")',
    },
    {
        content: "Modify payslip line",
        trigger: ".o_field_widget[name=line_ids] .o_field_widget[name=amount] input",
        run: "edit 4321.00",
    },
    {
        content: "Click out",
        trigger: 'span:contains("Tip")',
    },
    {
        content: "Check that the line is indeed modified",
        trigger: '.o_field_widget[name=line_ids] td.o_data_cell:contains("4,321.00")',
        isCheck: true,
    },
    {
        content: "Validate changes",
        trigger: ".btn-primary:contains('Validate Edition')",
    },
    {
        content: "Click on Salary Computation page",
        trigger: 'a:contains("Salary Computation")',
    },
    {
        content: "Check that payslip line is indeed modofied",
        trigger: '.o_field_widget[name=line_ids] td.o_data_cell:contains("4,321.00")',
        isCheck: true,
    },
]});
