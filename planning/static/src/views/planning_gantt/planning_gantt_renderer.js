/* @odoo-module */

import { formatFloatTime } from "@web/views/fields/formatters";
import { user } from "@web/core/user";
import { formatFloat } from "@web/core/utils/numbers";
import { GanttRenderer } from "@web_gantt/gantt_renderer";
import { getUnionOfIntersections } from "@web_gantt/gantt_helpers";
import { PlanningEmployeeAvatar } from "./planning_employee_avatar";
import { PlanningGanttRowProgressBar } from "./planning_gantt_row_progress_bar";
import { useEffect, onWillStart, useRef } from "@odoo/owl";
import { serializeDateTime } from "@web/core/l10n/dates";

const { Duration, DateTime } = luxon;

export class PlanningGanttRenderer extends GanttRenderer {
    static rowHeaderTemplate = "planning.PlanningGanttRenderer.RowHeader";
    static pillTemplate = "planning.PlanningGanttRenderer.Pill";
    static rowContentTemplate = "planning.PlanningGanttRenderer.RowContent";
    static headerTemplate = "planning.PlanningGanttRenderer.Header";
    static components = {
        ...GanttRenderer.components,
        Avatar: PlanningEmployeeAvatar,
        GanttRowProgressBar: PlanningGanttRowProgressBar,
    };
    setup() {
        this.duplicateToolHelperRef = useRef("duplicateToolHelper");
        super.setup();
        useEffect(() => {
            this.rootRef.el.classList.add("o_planning_gantt");
        });

        this.isPlanningManager = false;
        onWillStart(this.onWillStart);
    }

    async onWillStart() {
        this.isPlanningManager = await user.hasGroup('planning.group_planning_manager');
    }

    /**
     * @override
     */
    addTo(pill, group) {
        if (!pill.allocatedHours[group.col]) {
            return false;
        }
        group.pills.push(pill);
        group.aggregateValue += pill.allocatedHours[group.col];
        return true;
    }

    computeDerivedParams() {
        this.rowsWithAvatar = {};
        super.computeDerivedParams();
    }

    /**
     * @override
     */
    getDurationStr(record) {
        const { allocated_hours, allocated_percentage } = record;
        const res = super.getDurationStr(...arguments);
        return allocated_percentage !== 100 && allocated_hours ? res : "";
    }

    /**
     * @override
     */
    enrichPill() {
        const pill = super.enrichPill(...arguments);
        const { record } = pill;

        if (record.employee_id && !this.model.metaData.groupedBy.includes("resource_id")) {
            const [resId, displayName] = record.employee_id;
            pill.hasAvatar = true;
            pill.avatarProps = {
                resModel: this.model.metaData.fields.employee_id.relation,
                resId,
                displayName,
            };
        } else {
            pill.hasAvatar = false;
            pill.avatarProps = {};
        }

        const model = this.props.model;
        if (model.highlightIds && !model.highlightIds.includes(record.id)) {
            pill.className += " opacity-25";
        }
        pill.allocatedHours = {};
        let percentage = record.allocated_percentage ? record.allocated_percentage / 100 : 0;
        if (percentage === 0) {
            return pill;
        }
        if (this.isOpenShift(record) || this.isFlexibleHours(record)) {
            for (let col = this.getFirstcol(pill); col < this.getLastCol(pill) + 1; col++) {
                const subColumn = this.subColumns[col - 1];
                if (!subColumn) {
                    continue;
                }
                const { start, stop } = subColumn;
                const maxDuration = stop.diff(start);
                const toMillisRatio = 60 * 60 * 1000;
                const dailyAllocHours = Math.min(record.allocated_hours * toMillisRatio / pill.grid.column[1], maxDuration);
                if (dailyAllocHours) {
                    let minutes = Duration.fromMillis(dailyAllocHours).as("minute");
                    minutes = Math.round(minutes / 5) * 5;
                    pill.allocatedHours[col] = Duration.fromObject({ minutes }).as("hour");
                }
            }
            return pill;
        }
        // The code below (the if statement) is used to cover the case of an employee working on days/hours on which
        // they have no work intervals (no work hours - work outside of schedule).
        // Here we could change the computation entirely but just changing the recordIntervals and the percentage
        // calculation is enough.
        let recordIntervals = this.getRecordIntervals(record);
        if (!recordIntervals.length) {
            recordIntervals = [[record.start_datetime, record.end_datetime]];
            percentage = (record.allocated_hours * 3.6e6) / record.end_datetime.diff(record.start_datetime);
        }
        for (let col = this.getFirstcol(pill) - 1; col <= this.getLastCol(pill) + 1; col++) {
            const subColumn = this.subColumns[col - 1];
            if (!subColumn) {
                continue;
            }
            const { start, stop } = subColumn;
            const interval = [start, stop.plus({ seconds: 1 })];
            const union = getUnionOfIntersections(interval, recordIntervals);
            let duration = 0;
            for (const [otherStart, otherEnd] of union) {
                duration += otherEnd.diff(otherStart);
            }
            if (duration) {
                let minutes = Duration.fromMillis(duration * percentage).as("minute");
                minutes = Math.round(minutes / 5) * 5;
                pill.allocatedHours[col] = Duration.fromObject({ minutes }).as("hour");
            }
        }
        return pill;
    }

    getAvatarProps(row) {
        return this.rowsWithAvatar[row.id];
    }

    /**
     * @override
     */
    getAggregateValue(group, previousGroup) {
        return group.aggregateValue + previousGroup.aggregateValue;
    }

    /**
     * @override
     */
    getColumnStartStop(columnStartIndex, columnStopIndex = columnStartIndex) {
        const { scale } = this.model.metaData;
        if (["week", "month"].includes(scale.id)) {
            const { start } = this.columns[columnStartIndex];
            const { stop } = this.columns[columnStopIndex];
            return {
                start: start.set({ hours: 8, minutes: 0, seconds: 0 }),
                stop: stop.set({ hours: 17, minutes: 0, seconds: 0 }),
            };
        }
        return super.getColumnStartStop(...arguments);
    }

    /**
     * @override
     */
    getGroupPillDisplayName(pill) {
        return formatFloatTime(pill.aggregateValue);
    }

    /**
     * @override
     */
    getPopoverProps(pill) {
        const popoverProps = super.getPopoverProps(pill);
        if (this.popoverTemplate) {
            const { record } = pill;
            Object.assign(popoverProps.context, {
                allocatedHoursFormatted:
                    record.allocated_hours && formatFloatTime(record.allocated_hours),
                allocatedPercentageFormatted:
                    record.allocated_percentage && formatFloat(record.allocated_percentage),
            });
        }
        return popoverProps;
    }

    /**
     * @param {RelationalRecord} record
     * @returns {any[]}
     */
    getRecordIntervals(record) {
        const val = record.resource_id;
        const resourceId = Array.isArray(val) ? val[0] : false;
        const startTime = record.start_datetime;
        const endTime = record.end_datetime;
        if (!this.model.data.workIntervals) {
            return [];
        }
        const resourceIntervals = this.model.data.workIntervals[resourceId];
        if (!resourceIntervals) {
            return [];
        }
        const recordIntervals = getUnionOfIntersections([startTime, endTime], resourceIntervals);
        return recordIntervals;
    }

    /**
     * @param {number} resource_id
     * @returns {boolean}
     */
    isFlexibleHours(resource_id) {
        return !!this.model.data.isFlexibleHours?.[resource_id];
    }

    /**
     * @param {RelationalRecord} record
     * @returns {boolean}
     */
    isOpenShift(record) {
        return !record.resource_id;
    }

    /**
     * By default in the gantt view we show aggregation info in the columns that have pills inside.
     * In the planning gantt view we colour the group rows based on whether the resource is under/over planned for a day.
     * This requires the aggregation info to remain visible even in the absence of pills.
     *
     * The checks below are done in this order because of their priority importance:
     * (no working intervals > flex-hours / pill present > non-working days > time-off)
     * @override
     */
    shouldAggregate(row, g) {
        // These checks only make sense if the gantt view is grouped by the resource
        if (row.groupedBy && row.groupedBy[0] !== 'resource_id') {
            return super.shouldAggregate(...arguments);
        }

        // A row not having work intervals could mean that a resource doesn't have a contract or the row is the "Total" row
        const workIntervals = this.model.data.workIntervals?.[row.resId];
        if (!workIntervals) {
            if (row.groupedByField === "resource_id") {  // If there is no contract, don't show aggregate info
                return false;
            } else if (!row.groupedByField) {  // If it's not grouped by anything, its the total row, follow default behaviour
                return super.shouldAggregate(...arguments);
            }
        }

        // We show aggregation info in all columns for flexible-hour employees and when there are pills in that day
        if ((row.resId && !row.unavailabilities) || super.shouldAggregate(...arguments)) {
            return true;
        }

        // We do not show aggregate info on non-working days
        const group = this.subColumns[g.grid.column[0] - 1];
        const groupWorkOverlap = getUnionOfIntersections([group.start, group.stop], workIntervals);
        if (!groupWorkOverlap.length) {
            return false;
        }

        // We do not show aggregate info on days with time-off
        const unavailabilities = Object.entries(row.unavailabilities).map(([key, {start, stop}]) => ([start, stop]));
        const dayOff = []
        for (const interval of groupWorkOverlap) {
            const dayOffInterval = getUnionOfIntersections(interval, unavailabilities);
            if (dayOffInterval.length) {
                dayOff.push(dayOffInterval);
            }
        }
        if (dayOff.length === groupWorkOverlap.length) {
            for (const [i, interval] of dayOff.entries()) {
                if (interval[0] <= groupWorkOverlap[i][0] && interval[1] >= groupWorkOverlap[i][1]) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * @override
     */
    getPillFromGroup(group, maxAggregateValue, consolidate) {
        const newPill = super.getPillFromGroup(...arguments);
        if (group.pills.length) {
            newPill.resourceId = group.pills[0].record.resource_id;
        }
        const { start, stop } = this.columns[newPill.grid.column[0] - 1]
        newPill.date_start = start;
        newPill.date_end = stop;
        return newPill;
    }

    _computeResourceOvertimeColors(pill) {
        const progressBar = this.row.progressBar;
        if (!progressBar?.employee_id || ["day", "year"].includes(this.model.metaData.scale.id)) {
            return "bg-primary border-primary";
        }

        let workHours = 0;
        const resource_id = this.row.resId;
        // If flexible hour contract, colour the gantt view group based on whether the aggregate value > the "average work hours" per day.
        if (this.isFlexibleHours(resource_id)) {
            workHours = this.model.data.avgWorkHours[resource_id];
        } else {
            workHours = this.model.data.workIntervals[resource_id].reduce(
                (sum, [ intervalStart, intervalEnd ]) => {
                    // Check whether the work interval is of the same date as the grouping pill
                    if (intervalStart >= pill.date_start && intervalEnd <= pill.date_end) {
                        sum += (intervalEnd - intervalStart) / 3.6e6;
                    }
                    return sum;
                }, 0
            )
        }
        return workHours == pill.aggregateValue ? 'bg-success border-success' : workHours > pill.aggregateValue ? 'bg-warning border-warning' : 'bg-danger border-danger';
    }

    hasAvatar(row) {
        return row.id in this.rowsWithAvatar;
    }

    /**
     * @override
     */
    isDisabled(row) {
        if (!row.fromServer) {
            return false;
        }
        return super.isDisabled(...arguments);
    }

    /**
     * @override
     */
    isHoverable(row) {
        if (!row.fromServer) {
            return !row.isGroup;
        }
        return super.isHoverable(...arguments);
    }

    processRow(row) {
        const { fromServer, groupedByField, name, progressBar } = row;
        const isGroupedByResource = groupedByField === "resource_id";
        const employeeId = progressBar && progressBar.employee_id;
        const isResourceMaterial = progressBar && progressBar.is_material_resource;
        const resourceColor = progressBar && progressBar.resource_color || 0;
        const showPopover = !isResourceMaterial || progressBar.display_popover_material_resource;
        const showEmployeeAvatar = isGroupedByResource && fromServer && Boolean(employeeId) || Boolean(row.resId && isResourceMaterial);
        if (showEmployeeAvatar) {
            const { fields } = this.model.metaData;
            const resModel = fields.resource_id.relation;
            this.rowsWithAvatar[row.id] = { resModel, resId: row.resId, displayName: name, isResourceMaterial, showPopover, resourceColor };
        }
        return super.processRow(...arguments);
    }

    /**
     * @override
     */
    shouldMergeGroups() {
        return false;
    }

    /**
     * @param {MouseEvent} ev
     * @param {Pill} pill
     * @param {number} splitIndex - Index of the split tool used on the pill
     */
    async onPillSplitToolClicked(ev, pill, splitIndex) {
        if (!this.isPlanningManager) {
            return;
        }
        const pillStart = pill.grid.column[0];

        // 1. Create a copy of the current pill after the split tool
        const startColumnId = pillStart + splitIndex;
        const { start } = this.getColumnAvailabilitiesLimit(pill, startColumnId, {
            fixed_stop: pill.record.end_datetime,
        });
        const values = { start_datetime: serializeDateTime(start) };
        await this.model.orm.call(
            this.model.metaData.resModel,
            'copy',
            [pill.record.id, values],
        );

        // 2. Reduce the size of the current pill down to the split tool
        const { stop } = this.getColumnAvailabilitiesLimit(pill, startColumnId - 1, {
            fixed_start: pill.record.start_datetime,
        });
        const schedule = { end_datetime: serializeDateTime(stop) };
        this.model.reschedule(pill.record.id, schedule, this.openPlanDialogCallback);
    }

    /**
     * Determines the earliest (in start) and latest (in stop) availability in a column for the row of a given pill.
     * If a fixed start/stop is set, the latest/earliest availability as to be after/before it. If the row shows no
     * availability respecting the given constraint, the returned start/stop allows to create a shift of 1 second.
     *
     * @param {Pill} pill
     * @param {number} column - Column index
     * @param {{ Datetime, Datetime }} { fixed_start, fixed_stop } - If set, indicates a fixed value for the start/stop result
     * @returns {{ Datetime, Datetime }} { start, stop }
     */
    getColumnAvailabilitiesLimit(pill, column, { fixed_start, fixed_stop } = {}) {
        const defaultColumnTiming = super.getColumnStartStop(column);
        let start = fixed_start || defaultColumnTiming.start;
        let stop = fixed_stop || defaultColumnTiming.stop;
        const currentRow = this.model.data.rows.find(row => row.resId === pill.record.resource_id[0]) || this.model.data.rows.find(row => row.resId === false);

        const unavailability_at_start = currentRow?.unavailabilities?.find(unavailability => start >= unavailability.start && start < unavailability.stop);
        const unavailability_at_stop = currentRow?.unavailabilities?.find(unavailability => stop > unavailability.start && stop <= unavailability.stop);

        if (!fixed_stop && unavailability_at_stop) {
            stop = unavailability_at_stop.start;
        }
        if (!fixed_start && unavailability_at_start && stop > start) {
            start = unavailability_at_start.stop;
        }
        if (stop <= start) {
            if (!fixed_start) {
                start = DateTime.fromMillis(stop - 1000);
            } else {
                stop = DateTime.fromMillis(start + 1000);
            }
        }
        return { start, stop };
    }

    onInteractionChange() {
        super.onInteractionChange();
        const { mode } = this.interaction;
        if (this.duplicateToolHelperRef.el) {
            if (mode === "drag") {
                this.duplicateToolHelperRef.el.classList.remove("invisible");
            } else {
                this.duplicateToolHelperRef.el.classList.add("invisible");
            }
        }
    }
}
