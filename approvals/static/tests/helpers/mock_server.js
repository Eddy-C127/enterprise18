/** @odoo-module **/

import '@mail/../tests/helpers/mock_server'; // ensure mail overrides are applied first
import MockServer from 'web.MockServer';

MockServer.include({
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    async _performRpc(route, args) {
        if (args.model === 'approval.approver' && args.method === 'action_approve') {
            const ids = args.args[0];
            return this._mockApprovalApproverActionApprove(ids);
        }
        if (args.model === 'approval.approver' && args.method === 'action_refuse') {
            const ids = args.args[0];
            return this._mockApprovalApproverActionApprove(ids);
        }
        return this._super(...arguments);
    },

    //--------------------------------------------------------------------------
    // Private Mocked Methods
    //--------------------------------------------------------------------------

    /**
     * Simulates `action_approve` on `approval.approver`.
     *
     * @private
     * @param {integer[]} ids
     */
    _mockApprovalApproverActionApprove(ids) {
        // TODO implement this mock and improve related tests (task-2300537)
    },
    /**
     * Simulates `action_refuse` on `approval.approver`.
     *
     * @private
     * @param {integer[]} ids
     */
    _mockApprovalApproverActionRefuse(ids) {
        // TODO implement this mock and improve related tests (task-2300537)
    },
    /**
     * @override
     */
    _mockMailActivityActivityFormat(args) {
        const activities = this._super(...arguments);
        for (const activity of activities) {
            if (activity.res_model === 'approval.request') {
                // check on activity type being approval not done here for simplicity
                const approver = this._getRecords('approval.approver', [
                    ['request_id', '=', activity.res_id],
                    ['user_id', '=', activity.user_id[0]],
                ])[0];
                if (approver) {
                    activity.approver_id = approver.id;
                    activity.approver_status = approver.status;
                }
            }
        }
        return activities;
    },
});
