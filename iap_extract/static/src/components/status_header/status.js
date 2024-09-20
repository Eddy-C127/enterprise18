/** @odoo-module **/

import { Component, onRendered, onWillDestroy, onWillStart, useState } from "@odoo/owl";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";

const CHECK_OCR_WAIT_DELAY = 5*1000;

export class StatusHeader extends Component {
    static template = "account_invoice_extract.Status";
    static props = standardFieldProps;

    setup() {
        this.state = useState({
          status: this.props.record.data.extract_state,
          error_message: this.props.record.data.extract_error_message,
          retry_loading: false,
        });
        if (this.state.status == "waiting_validation") {
            this.state.status = "do_not_show";
        };
        this.orm = useService("orm");
        this.action = useService("action");
        this.busService = this.env.services.bus_service;

        onWillStart(() => {
            const document_uuid = this.props.record.data.extract_document_uuid;
            this.subscribeToChannel(document_uuid);
            this.busService.subscribe("state_change", ({status, error_message})=> {
                this.state.status = status;
                this.state.error_message = error_message;
            });
        });
        onWillDestroy(() => {
            this.busService.deleteChannel(this.channelName);
            clearTimeout(this.timeoutId);
        });
        onRendered(() => this.enableTimeout());
    };

    subscribeToChannel(document_uuid) {
        this.busService.deleteChannel(this.channelName);
        this.channelName = `extract.mixin.status#${document_uuid}`;
        this.busService.addChannel(this.channelName);
    }

    getDocumentType() {
        const modelToName = {
            'account.move': _t('invoice'),
            'account.bank.statement': _t('statement'),
            'hr.candidate': _t('resume'),
            'hr.expense': _t('expense'),
        }
        return modelToName[this.props.record.resModel] ?? _t("document");
    }

    enableTimeout () {
        if (!['waiting_extraction', 'extract_not_ready'].includes(this.state.status)) return;

        clearTimeout(this.timeoutId);

        this.timeoutId = setTimeout(async () => {
            if (['waiting_extraction', 'extract_not_ready'].includes(this.state.status)) {
                await this.orm.call(this.props.record.resModel, "check_ocr_status", [this.props.record.resId], {});
            };
        }, CHECK_OCR_WAIT_DELAY);
    };

    checkOcrStatus = async () => await this.orm.call(this.props.record.resModel, "check_ocr_status", [this.props.record.resId], {});

    refreshPage = () => window.location.reload();

    async buyCredits() {
        const actionData = await this.orm.call(this.props.record.resModel, "buy_credits", [this.props.record.resId], {});
        this.action.doAction(actionData);
    };

    async retryDigitalization() {
        this.state.retry_loading = true;
        const [status, error_message, document_uuid] = await this.orm.call(this.props.record.resModel, "action_manual_send_for_digitization", [this.props.record.resId], {});
        this.subscribeToChannel(document_uuid);
        this.state.status = status;
        this.state.error_message = error_message;
        this.state.retry_loading = false;
        this.enableTimeout();
    };
};

registry.category("fields").add("extract_state_header", {component: StatusHeader});
