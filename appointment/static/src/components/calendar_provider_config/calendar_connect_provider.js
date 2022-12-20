/** @odoo-module **/

import { patch } from '@web/core/utils/patch';
import { CalendarConnectProvider } from "@calendar/components/calendar_provider_config/calendar_connect_provider";


patch(CalendarConnectProvider.prototype, 'calendar_connect_provider_appointment_onboarding', {
    /**
     * Sets onboarding step state as completed.
     *
     * @override
     */
    async _beforeLeaveContext () {
        return this.orm.call(
            'onboarding.onboarding.step',
            'action_save_appointment_onboarding_configure_calendar_provider_step',
        );
    }
});
