import { CalendarCommonRenderer } from "@web/views/calendar/calendar_common/calendar_common_renderer";

export class ProjectTaskCalendarCommonRenderer extends CalendarCommonRenderer {
    /**
     * @override
     */
    eventClassNames(info) {
        const classesToAdd = super.eventClassNames(info);
        const { event } = info;
        const model = this.props.model;
        const record = model.records[event.id];

        if (record && model.highlightIds && !model.highlightIds.includes(record.id)) {
            classesToAdd.push("opacity-25");
        }
        return classesToAdd;
    }
}
