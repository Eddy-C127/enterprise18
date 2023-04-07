/** @odoo-module */

import { deserializeDate } from "@web/core/l10n/dates";
import { GridRenderer } from "@web_grid/views/grid_renderer";
import { onWillStart } from "@odoo/owl";

export class TimesheetGridRenderer extends GridRenderer {
    static components = {
        ...GridRenderer.components,
    };

    setup() {
        super.setup();
        onWillStart(this.onWillStart);
    }

    async onWillStart() {
        await this._getLastValidatedTimesheetDate();
    }

    getUnavailableClass(column, cellData = {}) {
        if (!this.props.model.unavailabilityDaysPerEmployeeId) {
            return "";
        }
        const unavailabilityClass = "o_grid_unavailable";
        let employee_id = false;
        if (cellData.section && this.props.model.sectionField?.name === "employee_id") {
            employee_id = cellData.section.value && cellData.section.value[0];
        } else if (cellData.row && "employee_id" in cellData.row.valuePerFieldName) {
            employee_id =
                cellData.row.valuePerFieldName.employee_id &&
                cellData.row.valuePerFieldName.employee_id[0];
        }
        const unavailabilityDays = this.props.model.unavailabilityDaysPerEmployeeId[employee_id];
        return unavailabilityDays && unavailabilityDays.includes(column.value)
            ? unavailabilityClass
            : "";
    }

    getFieldAdditionalProps(fieldName) {
        const props = super.getFieldAdditionalProps(fieldName);
        if (fieldName in this.props.model.workingHoursData) {
            props.workingHours = this.props.model.workingHoursData[fieldName];
        }
        return props;
    }

    async _getLastValidatedTimesheetDate() {
        this.lastValidationDatePerEmployee = {};
        if (this.props.sectionField?.name === 'employee_id') {
            const employeeIds = this.props.model._dataPoint._getFieldValuesInSectionAndRows(this.props.model.fieldsInfo.employee_id);
            if (employeeIds.length) {
                const result = await this.props.model.orm.call(
                    "hr.employee",
                    "get_last_validated_timesheet_date",
                    [employeeIds],
                );
                for (const [employee_id, last_validated_timesheet_date] of Object.entries(result)) {
                    this.lastValidationDatePerEmployee[employee_id] = last_validated_timesheet_date && deserializeDate(last_validated_timesheet_date);
                }
            }
        }
    }

    get displayAddLine() {
        const res = super.displayAddLine;
        if (!res || this.props.sectionField?.name !== "employee_id") {
            return res;
        }

        const employeeId = this.row.section.valuePerFieldName.employee_id[0];
        if (employeeId in this.lastValidationDatePerEmployee) {
            return res && (!this.lastValidationDatePerEmployee[employeeId] || this.lastValidationDatePerEmployee[employeeId].startOf("day") < this.props.model.navigationInfo.periodEnd.startOf("day"));
        }
    }

    getCellColorClass(column) {
        const res = super.getCellColorClass(...arguments);
        const workingHours = this.props.model.data.workingHours.dailyPerEmployee?.[this.section.valuePerFieldName.employee_id[0]];
        if (!workingHours) {
            return res;
        }

        const value = workingHours[column.value];
        const cellValue = this.section.cells[column.id].value;
        if (cellValue > value) {
            return "text-warning";
        } else if (cellValue < value) {
            return "text-danger";
        }

        return res;
    }

    isTextDanger(row, column) {
        const params = this.props.model.searchParams;
        return (
            !params.groupBy.length ||
            params.groupBy[0] === "employee_id"
        ) && (row.cells[column.id].value > 24);
    }
}
