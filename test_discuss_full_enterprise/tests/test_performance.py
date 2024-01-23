# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.test_discuss_full.tests.test_performance import TestDiscussFullPerformance

old_method = TestDiscussFullPerformance._get_init_messaging_result


def _get_init_messaging_result(self):
    res = old_method(self)
    res["Store"].update({
        "hasDocumentsUserGroup": False,
        "helpdesk_livechat_active": False,
        "voipConfig": {
            'mode': 'demo',
            'missedCalls': 0,
            'pbxAddress': "localhost",
            'webSocketUrl': self.env["ir.config_parameter"].sudo().get_param("voip.wsServer", default="ws://localhost"),
        },
    })
    return res


TestDiscussFullPerformance._get_init_messaging_result = _get_init_messaging_result
TestDiscussFullPerformance._query_count += 11
