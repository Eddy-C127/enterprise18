# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.test_discuss_full.tests.test_performance import TestDiscussFullPerformance

old_get_init_store_data_result = TestDiscussFullPerformance._get_init_store_data_result
old_get_init_messaging_result = TestDiscussFullPerformance._get_init_messaging_result

def _get_init_store_data_result(self):
    res = old_get_init_store_data_result(self)
    res["Store"]["settings"].update({
        "homemenu_config": False,
        "how_to_call_on_mobile": "ask",
        "external_device_number": False,
        "onsip_auth_username": False,
        "should_call_from_another_device": False,
        "should_auto_reject_incoming_calls": False,
        "voip_secret": False,
        "voip_username": False,
        "is_discuss_sidebar_category_whatsapp_open": True,
    })
    return res

def _get_init_messaging_result(self):
    res = old_get_init_messaging_result(self)
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

TestDiscussFullPerformance._get_init_store_data_result = _get_init_store_data_result
TestDiscussFullPerformance._get_init_messaging_result = _get_init_messaging_result
TestDiscussFullPerformance._query_count += 10
