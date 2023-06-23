/** @odoo-module **/
import { patch } from "@web/core/utils/patch";

import { BankRecKanbanController } from "@account_accountant/components/bank_reconciliation/kanban";

patch(BankRecKanbanController.prototype, "account_accountant_batch_payment", {

    // -----------------------------------------------------------------------------
    // HELPERS
    // -----------------------------------------------------------------------------

    /** override **/
    getChildSubEnv(){
        const env = this._super(...arguments);

        env.methods.actionAddNewBatchPayment = this.actionAddNewBatchPayment.bind(this);
        env.methods.actionRemoveNewBatchPayment = this.actionRemoveNewBatchPayment.bind(this);

        return env;
    },

    notebookBatchPaymentsListViewProps(){
        const initParams = this.state.bankRecEmbeddedViewsData.batch_payments;

        return {
            type: "list",
            noBreadcrumbs: true,
            resModel: "account.batch.payment",
            searchMenuTypes: ["filter"],
            domain: initParams.domain,
            dynamicFilters: initParams.dynamic_filters,
            context: initParams.context,
            allowSelectors: false,
            searchViewId: false, // little hack: force to load the search view info
            globalState: initParams.exportState,
        }
    },

    // -----------------------------------------------------------------------------
    // RPC
    // -----------------------------------------------------------------------------

    async actionAddNewBatchPayment(batchId){
        await this.execProtectedBankRecAction(async () => {
            await this.withNewState(async (newState) => {
                await this.onchange(newState, "add_new_batch_payment", [batchId]);
            });
        });
    },

    async actionRemoveNewBatchPayment(batchId){
        await this.execProtectedBankRecAction(async () => {
            await this.withNewState(async (newState) => {
                await this.onchange(newState, "remove_new_batch_payment", [batchId]);
            });
        });
    },

    async actionValidateOnCloseWizard(){
        await this.execProtectedBankRecAction(async () => {
            await this.withNewState(async (newState) => {
                await this.onchange(newState, "validate_no_batch_payment_check");
                const result = newState.bankRecRecordData.return_todo_command;
                if(result.done){
                    await this.moveToNextLine(newState);
                }
            });
        });
    },

    /** override **/
    async _actionValidate(newState){
        await this._super(...arguments);
        if(!newState.bankRecRecordData){
            return;
        }

        const result = newState.bankRecRecordData.return_todo_command;

        if(result.open_batch_rejection_wizard){
            const validateFunc = this.actionValidateOnCloseWizard.bind(this);
            this.action.doAction(
                result.open_batch_rejection_wizard,
                {
                    onClose: async (nextAction) => {
                        if(nextAction === "validate"){
                            await validateFunc();
                        }
                    },
                }
            );
        }
    },

});
