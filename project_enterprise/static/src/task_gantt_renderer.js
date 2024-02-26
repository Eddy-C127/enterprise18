/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { Avatar } from "@mail/views/web/fields/avatar/avatar";
import { markup, useEffect } from "@odoo/owl";
import { localization } from "@web/core/l10n/localization";
import { usePopover } from "@web/core/popover/popover_hook";
import { useService } from "@web/core/utils/hooks";
import { GanttRenderer } from "@web_gantt/gantt_renderer";
import { escape } from "@web/core/utils/strings";
import { MilestonesPopover } from "./milestones_popover";
import { TaskGanttPopover } from "./task_gantt_popover";
import { FormViewDialog } from "@web/views/view_dialogs/form_view_dialog";
import { formatFloatTime } from "@web/views/fields/formatters";

export class TaskGanttRenderer extends GanttRenderer {
    static components = {
        ...GanttRenderer.components,
        Avatar,
        Popover: TaskGanttPopover,
    };
    static headerTemplate = "project_enterprise.TaskGanttRenderer.Header";
    static rowHeaderTemplate = "project_enterprise.TaskGanttRenderer.RowHeader";
    static rowContentTemplate = "project_enterprise.TaskGanttRenderer.RowContent";
    static totalRowTemplate = "project_enterprise.TaskGanttRenderer.TotalRow";
    static pillTemplate = "project_enterprise.TaskGanttRenderer.Pill";
    setup() {
        super.setup(...arguments);
        this.notificationService = useService("notification");
        useEffect(
            (el) => el.classList.add("o_project_gantt"),
            () => [this.rootRef.el]
        );
        const position = localization.direction === "rtl" ? "bottom" : "right";
        this.milestonePopover = usePopover(MilestonesPopover, { position });
    }

    computeColumns() {
        super.computeColumns();
        this.columnMilestones = {}; // deadlines and milestones by project
        for (const column of this.columns) {
            this.columnMilestones[column.id] = {
                hasDeadLineExceeded: false,
                allReached: true,
                projects: {},
                hasMilestone: false,
                hasDeadline: false,
                hasStartDate: false,
            };
        }
        // Handle start date at the beginning of the current period
        this.columnMilestones[this.columns[0].id].edge = {
            projects: {},
            hasStartDate: false,
        };
        const projectStartDates = [...this.model.data.projectStartDates];
        const projectDeadlines = [...this.model.data.projectDeadlines];
        const milestones = [...this.model.data.milestones];

        let project = projectStartDates.shift();
        let projectDeadline = projectDeadlines.shift();
        let milestone = milestones.shift();
        let i = 0;
        while (i < this.columns.length && (project || projectDeadline || milestone)) {
            const column = this.columns[i];
            const nextColumn = this.columns[i + 1];
            const info = this.columnMilestones[column.id];

            if (i == 0 && project && column && column.stop > project.date) {
                // For the first column, start dates have to be displayed at the start of the period
                if (!info.edge.projects[project.id]) {
                    info.edge.projects[project.id] = {
                        milestones: [],
                        id: project.id,
                        name: project.name,
                    };
                }
                info.edge.projects[project.id].isStartDate = true;
                info.edge.hasStartDate = true;
                project = projectStartDates.shift();
            } else if (project && nextColumn?.stop > project.date) {
                if (!info.projects[project.id]) {
                    info.projects[project.id] = {
                        milestones: [],
                        id: project.id,
                        name: project.name,
                    };
                }
                info.projects[project.id].isStartDate = true;
                info.hasStartDate = true;
                project = projectStartDates.shift();
            }

            if (projectDeadline && column.stop > projectDeadline.date) {
                if (!info.projects[projectDeadline.id]) {
                    info.projects[projectDeadline.id] = {
                        milestones: [],
                        id: projectDeadline.id,
                        name: projectDeadline.name,
                    };
                }
                info.projects[projectDeadline.id].isDeadline = true;
                info.hasDeadline = true;
                projectDeadline = projectDeadlines.shift();
            }

            if (milestone && column.stop > milestone.deadline) {
                const [projectId, projectName] = milestone.project_id;
                if (!info.projects[projectId]) {
                    info.projects[projectId] = {
                        milestones: [],
                        id: projectId,
                        name: projectName,
                    };
                }
                const { is_deadline_exceeded, is_reached } = milestone;
                info.projects[projectId].milestones.push(milestone);
                info.hasMilestone = true;
                milestone = milestones.shift();
                if (is_deadline_exceeded) {
                    info.hasDeadLineExceeded = true;
                }
                if (!is_reached) {
                    info.allReached = false;
                }
            }
            if (
                (!project || nextColumn?.stop < project.date) &&
                (!projectDeadline || column.stop < projectDeadline.date) &&
                (!milestone || column.stop < milestone.deadline)
            ) {
                i++;
            }
        }
    }

    computeDerivedParams() {
        this.rowsWithAvatar = {};
        super.computeDerivedParams();
    }

    getConnectorAlert(masterRecord, slaveRecord) {
        if (
            masterRecord.display_warning_dependency_in_gantt &&
            slaveRecord.display_warning_dependency_in_gantt
        ) {
            return super.getConnectorAlert(...arguments);
        }
    }

    getPopoverProps(pill) {
        const props = super.getPopoverProps(...arguments);
        const { record } = pill;
        if (record.planning_overlap) {
            props.context.planningOverlapHtml = markup(record.planning_overlap);
        }
        props.unschedule = async () => {
            await this.model.unscheduleTask(record.id);
        };
        props.context.allocated_hours = formatFloatTime(props.context.allocated_hours);
        return props;
    }

    getAvatarProps(row) {
        return this.rowsWithAvatar[row.id];
    }

    getSelectCreateDialogProps() {
        const props = super.getSelectCreateDialogProps(...arguments);
        const onCreateEdit = () => {
            this.dialogService.add(FormViewDialog, {
                context: props.context,
                resModel: props.resModel,
                onRecordSaved: async (record) => {
                    await record.save({ reload: false });
                    await this.model.fetchData();
                },
            });
        };
        props.onCreateEdit = onCreateEdit;
        props.context.smart_task_scheduling = true;
        return props;
    }

    hasAvatar(row) {
        return row.id in this.rowsWithAvatar;
    }

    openPlanDialogCallback(res) {
        if (!res || Array.isArray(res)) {
            return;
        }
        for (const [warningType, warningString] of Object.entries(res)) {
            if (warningType === "out_of_scale_notification") {
                this.notificationService.add(
                    markup(
                        `<i class="fa btn-link fa-check"></i><span class="ms-1">${escape(
                            warningString
                        )}</span>`
                    ),
                    {
                        type: "success",
                    }
                );
            } else {
                this.notificationService.add(warningString, {
                    title: _t("Warning"),
                    type: "warning",
                    sticky: true,
                });
            }
        }
    }

    processRow(row) {
        const { groupedByField, name, resId } = row;
        if (groupedByField === "user_ids" && Boolean(resId)) {
            const { fields } = this.model.metaData;
            const resModel = fields.user_ids.relation;
            this.rowsWithAvatar[row.id] = { resModel, resId, displayName: name };
        }
        return super.processRow(...arguments);
    }

    shouldRenderRecordConnectors(record) {
        if (record.allow_task_dependencies) {
            return super.shouldRenderRecordConnectors(...arguments);
        }
        return false;
    }

    highlightPill(pillId, highlighted) {
        if (!this.connectorDragState.dragging) {
            return super.highlightPill(pillId, highlighted);
        }
        const pill = this.pills[pillId];
        if (!pill) {
            return;
        }
        const { record } = pill;
        if (!this.shouldRenderRecordConnectors(record)) {
            return super.highlightPill(pillId, false);
        }
        return super.highlightPill(pillId, highlighted);
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    onMilestoneMouseEnter(ev, projects) {
        this.milestonePopover.open(ev.target, {
            displayMilestoneDates: this.model.metaData.scale.id === "year",
            displayProjectName: !this.model.searchParams.context.default_project_id,
            projects,
        });
    }

    onMilestoneMouseLeave() {
        this.milestonePopover.close();
    }
}
