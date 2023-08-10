/** @odoo-module */

import { FormController } from "@web/views/form/form_controller";
import { onMounted, onWillStart } from "@odoo/owl";

export class HelpdeskTeamController extends FormController {
    setup() {
        super.setup();
        this.reloadInstall = false;
        this.fieldsToObserve = {};
        this.featuresToObserve = {};
        this.featuresToCheck = [];
        onWillStart(this.onWillStart);
        onMounted(() => {
            this.updateFieldsToObserve()
        });
    }

    async onWillStart() {
        this.featuresToObserve = await this.orm.call(
            this.modelParams.config.resModel,
            "check_features_enabled",
            [],
        );
    }

    updateFieldsToObserve() {
        for (const [fieldName, value] of Object.entries(this.model.root.data)) {
            if (fieldName.startsWith("use_")) {
                this.fieldsToObserve[fieldName] = value;
            }
        }
    }

    /**
     *
     * @override
     */
    async onWillSaveRecord(record) {
        const fields = [];
        for (const [fName, value] of Object.entries(record.data)) {
            if (this.fieldsToObserve[fName] !== value){
                if (fName in this.fieldsToObserve) {
                    fields.push(fName);
                }
                if (fName in this.featuresToObserve) {
                    this.featuresToCheck.push(fName);
                }
            }
        }
        if (Object.keys(fields).length) {
            this.reloadInstall = await record.model.orm.call(
                record.resModel,
                "check_modules_to_install",
                [fields]
            );
        }
    }

    /**
     * @override
     */
    async onRecordSaved(record) {
        let updatedEnabledFeatures = {};
        if (!this.reloadInstall && this.featuresToCheck.length) {
            updatedEnabledFeatures = await record.model.orm.call(
                record.resModel,
                "check_features_enabled",
                [this.featuresToCheck]
            );
        }
        if (
            this.reloadInstall ||
            Object.entries(updatedEnabledFeatures).some(([fName, value]) => value !== this.featuresToObserve[fName])
        ) {
            this.reloadInstall = false;
            this.model.action.doAction("reload_context");
        }
        this.updateFieldsToObserve();
        this.featuresToCheck = [];
    }
}
