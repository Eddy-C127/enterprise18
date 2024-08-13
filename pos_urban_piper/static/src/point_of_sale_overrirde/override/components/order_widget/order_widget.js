import { OrderWidget } from "@point_of_sale/app/generic_components/order_widget/order_widget";
import { patch } from "@web/core/utils/patch";

patch(OrderWidget, {
    props: {
        ...OrderWidget.props,
        delivery_note: { optional: true },
    },

    defaultProps: {
        ...OrderWidget.defaultProps,
        delivery_note: "",
    },
});
