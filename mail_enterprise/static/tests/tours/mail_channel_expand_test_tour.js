/** @odoo-module **/

import { registry } from "@web/core/registry";

/**
 * This tour depends on data created by python test in charge of launching it.
 * It is not intended to work when launched from interface. It is needed to test
 * an action (action manager) which is not possible to test with QUnit.
 * @see mail_enterprise/tests/test_mail_channel_expand.py
 */
registry.category("web_tour.tours").add('mail_enterprise/static/tests/tours/mail_channel_expand_test_tour.js', {
    test: true,
    steps: [{
    content: "Click on chat window header expand button to open channel in Discuss",
    trigger: '.o_ChatWindow:has(.o_ChatWindowHeaderView_name:contains("test-mail-channel-expand-tour")) .o_ChatWindowHeaderView_commandExpand',
}, {
    content: "Check that first message of #test-mail-channel-expand-tour is shown in Discuss app",
    trigger: '.o_DiscussView .o_MessageView_content:contains("test-message-mail-channel-expand-tour")',
    run: () => {},
}]});
