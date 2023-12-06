/** @odoo-module **/

import { useService } from "@web/core/utils/hooks";
import { Component } from "@odoo/owl";

export class PayrollDashboardActionBox extends Component {
    static template = "hr_payroll.ActionBox";
    static props = ["actions"];

    setup() {
        this.actionService = useService("action");
    }
}
