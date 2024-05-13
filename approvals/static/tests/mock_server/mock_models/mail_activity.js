import { mailModels } from "@mail/../tests/mail_test_helpers";

export class MailActivity extends mailModels.MailActivity {

    /** @param {number[]} ids */
    activity_format(ids) {
        const activities = super.activity_format(...arguments);
        for (const activity of activities) {
            if (activity.res_model === 'approval.request') {
                // check on activity type being approval not done here for simplicity
                const [approver] = this.env["approval.approver"]._filter([
                    ['request_id', '=', activity.res_id],
                    ['user_id', '=', activity.user_id[0]],
                ]);
                if (approver) {
                    activity.approver_id = approver.id;
                    activity.approver_status = approver.status;
                }
            }
        }
        return activities;
    }
}
