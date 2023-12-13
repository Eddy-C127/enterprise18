/** @odoo-module **/
"use_strict";

import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { markup } from "@odoo/owl";

registry.category("web_tour.tours").add('sale_subscription_tour', {
    url: "/web",
    sequence: 250,
    rainbowMan: true,
    rainbowManMessage: () => markup(_t("<b>Congratulations!</b>, You sent your first subscription quote.")),
    steps: () => [{
    trigger: '.o_app[data-menu-xmlid="sale_subscription.menu_sale_subscription_root"]',
	content: _t('Ready for automated billing and deliveries through subscription management? get started by clicking here.'),
    position: 'bottom',
},
{
    trigger: '.o_list_button_add',
    extra_trigger: '.o_list_renderer',
    content: _t('Let\'s create your first subscription.'),
    position: 'right',
},
{
    trigger: '.o_field_widget[name="partner_id"]',
    content: _t('Let\'s choose the customer for your subscription.'),
    position: 'right',
},
{
    trigger: 'div.o_row',
    content:  _t("Choose the invoice duration for your subscription."),
    position: "bottom",
},
{
    trigger: ".o_field_x2many_list_row_add > a",
    content:  _t('Click here to add some products or services.'),
    run: 'click',
},
{
    trigger: ".o_field_widget[name='product_id'], .o_field_widget[name='product_template_id']",
    extra_trigger: ".o_sale_order",
    content: _t("Select a subscription product or create a new one on the fly."),
    position: "right",
},
{
    trigger: ".o_field_widget[name='price_unit']",
    content: _t("Set a price."),
    position: "right",
},
{
    trigger: 'button[id="send_by_email_primary"]',
    content:  _t("Send the quote to yourself and check what the customer will receive."),
    position: "bottom",
},
{
    trigger: 'button.o_mail_send',
    content:  _t("Let's send the quote."),
    position: "bottom",
},
]});
