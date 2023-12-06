/** @odoo-module **/

import { registry } from "@web/core/registry";
import { kanbanView } from "@web/views/kanban/kanban_view";
import { listView } from '@web/views/list/list_view';

import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";
import { useService } from "@web/core/utils/hooks";
import { ListRenderer } from '@web/views/list/list_renderer';

import { Component, onWillStart } from "@odoo/owl";

export class CampaignActionHelper extends Component {
    static template = "marketing.CampaignActionHelper";
    static props = {};

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");

        onWillStart(async () => {
            this.campaignTemplateData = await this.orm.call(
                "marketing.campaign",
                "get_campaign_templates_info",
                []
            );
        });
    }

    async onTemplateClick(template_str) {
        const action = await this.orm.call(
            "marketing.campaign",
            "get_action_marketing_campaign_from_template",
            [template_str],
        );
        if (!action) {
            return;
        }
        this.action.doAction(action);
    }
};

export class CampaignKanbanRenderer extends KanbanRenderer {
    static template = "marketing.CampaignKanbanRenderer";
    static components = {
        ...CampaignKanbanRenderer.components,
        CampaignActionHelper,
    };
};

export const CampaignKanbanView = {
    ...kanbanView,
    Renderer: CampaignKanbanRenderer,
};

registry.category("views").add("marketing_campaign_kanban_view", CampaignKanbanView);


export class CampaignListRenderer extends ListRenderer {
    static template = "marketing.CampaignListRenderer";
    static components = {
        ...CampaignListRenderer.components,
        CampaignActionHelper,
    };
};

export const CampaignListView = {
    ...listView,
    Renderer: CampaignListRenderer,
};

registry.category("views").add("marketing_campaign_list_view", CampaignListView);
