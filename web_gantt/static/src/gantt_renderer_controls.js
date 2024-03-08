import { Component } from "@odoo/owl";
import { useDateTimePicker } from "@web/core/datetime/datetime_hook";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { _t } from "@web/core/l10n/translation";
import { useGanttResponsivePopover } from "./gantt_helpers";
import { formatDateTime } from "@web/core/l10n/dates";

const { DateTime } = luxon;

export class GanttRendererControls extends Component {
    static template = "web_gantt.GanttRendererControls";
    static components = {
        Dropdown,
        DropdownItem,
    };
    static props = ["*"];
    static toolbarContentTemplate = "web_gantt.GanttRendererControls.ToolbarContent";

    setup() {
        const getPickerProps = (dateKey) => ({
            value: this.props[dateKey],
            type: "date",
        });
        this.startPicker = useDateTimePicker({
            target: "start-picker",
            onApply: this.props.onStartDateChanged,
            get pickerProps() {
                return getPickerProps("startDate");
            },
            createPopover: (...args) => useGanttResponsivePopover(_t("Gantt start date"), ...args),
            ensureVisibility: () => false,
        });
        this.stopPicker = useDateTimePicker({
            target: "stop-picker",
            onApply: this.props.onStopDateChanged,
            get pickerProps() {
                return getPickerProps("stopDate");
            },
            createPopover: (...args) => useGanttResponsivePopover(_t("Gantt stop date"), ...args),
            ensureVisibility: () => false,
        });
    }

    get todayDay() {
        return DateTime.local().day;
    }

    /**
     * @param {DateTime} date
     * @returns {string}
     */
    getFormattedDate(date) {
        const format = this.env.isSmall ? "dd MMM yyyy" : "dd MMMM yyyy";
        return formatDateTime(date, { format });
    }
}
