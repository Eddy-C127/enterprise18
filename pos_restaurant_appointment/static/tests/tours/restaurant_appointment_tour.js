import * as Dialog from "@point_of_sale/../tests/tours/utils/dialog_util";
import { registry } from "@web/core/registry";
import * as RestaurantAppointment from "@pos_restaurant_appointment/../tests/tours/utils/restaurant_appointment_util";
import * as Chrome from "@point_of_sale/../tests/tours/utils/chrome_util";

registry.category("web_tour.tours").add("RestaurantAppointmentTour", {
    test: true,
    url: "/pos/ui",
    steps: () =>
        [
            Dialog.confirm("Open session"),

            // Check that the booking gantt view is shown.
            {
                trigger: ".pos-leftheader button:contains('Booking')",
                run: "click",
            },
            {
                content: "Check that the booking gantt view is shown",
                trigger: ".pos-content .o_action_manager .o_gantt_view",
            },
            {
                content: "Close the booking gantt view",
                trigger: ".o_control_panel:contains('Manage Bookings')",
            },
            Chrome.clickPlanButton(),

            RestaurantAppointment.appointmentLabel(5, "Test Lunch"),
        ].flat(),
});
