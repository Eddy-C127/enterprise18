/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { registry } from '@web/core/registry';
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";
import { useService } from "@web/core/utils/hooks";

const { Component, useEffect } = owl;

export class AppointmentInviteCopyClose extends Component {
    /**
     * We want to disable the "Save & Copy" button if there is a warning that could
     * result to have an incorrect/empty link.
     */
    setup() {
        super.setup();
        this.notification = useService("notification");
        useEffect((saveButton, warning) => {
            if (saveButton) {
                saveButton.classList.toggle('disabled', !!warning);
            }
        }, () => [document.querySelector('.o_appointment_invite_copy_save'), document.querySelector('.alert.alert-warning')]);
    }
    /**
     * Save the invitation and copy the url in the clipboard
     * @param ev
     */
     async onSaveAndCopy (ev) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (await this.props.record.save()) {
            const bookUrl = this.props.record.data.book_url;
            setTimeout(async () => {
                await browser.navigator.clipboard.writeText(bookUrl);
                this.notification.add(
                    this.env._t("Link copied to clipboard!"),
                    { type: "success" }
                );
                this.env.dialogData.close();
            });
        }
    }
}
AppointmentInviteCopyClose.props = {
    ...standardWidgetProps,
};
AppointmentInviteCopyClose.template = 'appointment.AppointmentInviteCopyClose';

export const appointmentInviteCopyClose = {
    component: AppointmentInviteCopyClose,
};
registry.category("view_widgets").add("appointment_invite_copy_close", appointmentInviteCopyClose);
