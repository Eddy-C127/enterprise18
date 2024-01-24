/** @odoo-module */

import { Component } from "@odoo/owl";
import { Orders } from "@pos_order_tracking_display/app/components/orders/orders";
import { OdooLogo } from "@point_of_sale/app/generic_components/odoo_logo/odoo_logo";
import { useOrderStatusDisplay } from "./order_tracking_display_service";
import { startOwl } from "@point_of_sale/startOwl";
export class OrderStatusDisplay extends Component {
    static template = "pos_order_tracking_display.OrderStatusDisplay";
    static components = { Orders, OdooLogo };
    static props = {};
    setup() {
        this.orders = useOrderStatusDisplay();
    }
}
startOwl(OrderStatusDisplay);
