/** @odoo-module */

import { Activity } from "@mail/core/web/activity";
import { patch } from "@web/core/utils/patch";

patch(Activity.prototype, {
    async onClickRequestSign() {
        const { res_model, res_id } = this.props.activity;
        const documentReference = res_model && res_id ? `${res_model},${res_id}` : false;
        await this.env.services["mail.activity"].requestSignature(
            this.props.activity.id,
            this.props.onActivityChanged.bind(this, this.thread),
            documentReference
        );
    },
});
