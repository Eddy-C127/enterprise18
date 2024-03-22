import * as Dialog from "@point_of_sale/../tests/tours/utils/dialog_util";
import { registry } from "@web/core/registry";
import * as RestaurantAppointment from "@pos_restaurant_appointment/../tests/tours/utils/restaurant_appointment_util";

registry.category("web_tour.tours").add("RestaurantAppointmentTour", {
    test: true,
    url: "/pos/ui",
    steps: () =>
        [
            Dialog.confirm("Open session"),
            RestaurantAppointment.appointmentLabel(5, "Test Lunch"),
        ].flat(),
});
