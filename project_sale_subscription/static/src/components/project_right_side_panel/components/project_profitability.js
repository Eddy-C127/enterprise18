import { patch } from "@web/core/utils/patch";
import { ProjectProfitability } from "@project/components/project_right_side_panel/components/project_profitability";

patch(ProjectProfitability.prototype, {
    _getOrmValue(offset, section) {
        if (section?.id === "subscriptions") {
            return {
                function: "get_subscription_items_data",
                args: [this.props.projectId, offset, 5, section.allSubscriptionIds],
            };
        } else {
            return super._getOrmValue(offset, section);
        }
    },
});
