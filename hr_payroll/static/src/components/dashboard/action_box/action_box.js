/** @odoo-module **/

import { useService } from "@web/core/utils/hooks";
import { Component, useState, onWillStart} from "@odoo/owl";
import { rpc } from "@web/core/network/rpc";


export class PayrollDashboardActionBox extends Component {
    static template = "hr_payroll.ActionBox";
    static props = ["*"];

    setup() {
        this.actionService = useService("action");
        this.state = useState({
            loading: true,
            warnings: {},
        })
        onWillStart(() => {
          rpc('/get_payroll_warnings').then(data => {
              this.state.warnings = data;
              this.state.loading = false;
            }
          )
          return Promise.resolve(true);
        })
    }
}
