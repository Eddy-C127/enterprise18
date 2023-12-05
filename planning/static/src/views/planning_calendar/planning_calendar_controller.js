/** @odoo-module **/

import { onWillStart } from "@odoo/owl";
import { serializeDateTime } from "@web/core/l10n/dates";
import { user } from "@web/core/user";
import { CalendarController } from "@web/views/calendar/calendar_controller";
import { PlanningCalendarFilterPanel } from "./planning_filter_panel/planning_calendar_filter_panel";
import { usePlanningControllerActions } from "../planning_hooks";
import { _t } from "@web/core/l10n/translation";

export class PlanningCalendarController extends CalendarController {
    static template = "planning.PlanningCalendarController";
    static components = {
        ...CalendarController.components,
        FilterPanel: PlanningCalendarFilterPanel,
    };

    setup() {
        super.setup(...arguments);

        onWillStart(this.onWillStart);

        const getDomain = () => this.model.computeDomain(this.model.data);
        this.planningControllerActions = usePlanningControllerActions({
            getDomain,
            getStartDate: () => this.model.rangeStart,
            getRecords: () => Object.values(this.model.records),
            getResModel: () => this.model.resModel,
            getAdditionalContext: () => ({
                default_start_datetime: serializeDateTime(this.model.rangeStart),
                default_end_datetime: serializeDateTime(this.model.rangeEnd),
                default_slot_ids: Object.values(this.model.records).map(rec => rec.id),
                scale: this.model.scale,
                active_domain: getDomain(),
            }),
            toggleHighlightPlannedFilter: (highlightPlannedIds) => this.env.searchModel.toggleHighlightPlannedFilter(highlightPlannedIds),
            reload: () => this.model.load(),
        });
    }

    get editRecordDefaultDisplayText() {
        return _t("New Shift");
    }

    async onWillStart() {
        this.isManager = await user.hasGroup("planning.group_planning_manager");
    }
};
