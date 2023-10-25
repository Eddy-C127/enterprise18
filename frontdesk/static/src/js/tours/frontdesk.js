/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/tour_service/tour_utils";
import { markup } from "@odoo/owl";

registry.category("web_tour.tours").add("frontdesk_tour", {
    url: "/web",
    rainbowManMessage: () => markup(_t("<b>Congratulations!!!</b> You have created your first visitor.")),
    steps: () => [
        stepUtils.showAppsMenuItem(),
        {
            trigger: '.o_app[data-menu-xmlid="frontdesk.frontdesk_menu_root"]',
            content: _t("Looking for a better way to manage your visitors? \n It begins right here."),
            position: "bottom",
            edition: "enterprise",
        },
        {
            trigger: '.dropdown-item[data-menu-xmlid="frontdesk.frontdesk_menu_visitors"]',
            content: _t("Here, you'll see list of all the visitors."),
            position: "bottom",
        },
        {
            trigger: ".o_list_button_add",
            content: _t("Let's add a new visitor."),
            position: "bottom",
        },
        {
            trigger: ".o_field_widget[name='name'] input",
            content: _t("Enter the visitor's name."),
            position: "bottom",
        },
        {
            trigger: ".o_field_widget[name='station_id'] .o_field_many2one_selection",
            content: _t("Select or create a station on the fly from where the visitor arrived."),
            position: "bottom",
        },
        {
            trigger: '.o_form_button_save',
            content: _t("Save the visitor."),
            position: 'bottom',
        },
    ],
});
