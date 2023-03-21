/** @odoo-module */

import { Domain } from "@web/core/domain";
import { serializeDate } from "@web/core/l10n/dates";
import { patch } from "@web/core/utils/patch";
import { TimesheetGridDataPoint } from "@timesheet_grid/views/timesheet_grid/timesheet_grid_model";

patch(TimesheetGridDataPoint.prototype, "project_timesheet_forecast.TimesheetGridDataPoint", {
    /**
     * @override
     */
    _postFetchAdditionalData() {
        const additionalGroups = this._super();

        /*
         * The goal of this code is to add records in the grid in order to ease encoding.
         * We will add entries if there are published 'slots' for the current employee, within a defined timeline
         * (depending on the scale).
         */

        const validPlanningFields = ["project_id", "employee_id"];
        const validRowFields = [];
        if (this.sectionField && validPlanningFields.includes(this.sectionField.name)) {
            validRowFields.push(this.sectionField.name);
        }
        for (const rowField of this.rowFields) {
            if (validPlanningFields.includes(rowField.name)) {
                validRowFields.push(rowField.name);
            }
        }

        const domain = new Domain([
            ["user_id", "=", this.searchParams.context.uid],
            ["state", "=", "published"],
            ["project_id", "!=", false],
            ["start_datetime", "<", serializeDate(this.navigationInfo.periodEnd)],
            ["end_datetime", ">", serializeDate(this.navigationInfo.periodStart)],
        ]);

        const previousWeekSlotsInfo = this.orm.webReadGroup(
            "planning.slot",
            domain.toList({}),
            validRowFields,
            validRowFields,
            { lazy: false }
        );

        /*
         * Convert timesheet info returned from 'project.project' and 'project.task' queries into the right data
         * formatting.
         */
        const prepareAdditionalData = (records, fieldName) => {
            const additionalData = {};
            for (const record of records) {
                let sectionKey = false;
                let sectionValue = null;
                if (this.sectionField) {
                    sectionKey = this._generateSectionKey(record);
                    sectionValue = record[this.sectionField.name];
                }
                const rowKey = this._generateRowKey(record);
                const { domain, values } = this._generateRowDomainAndValues(record);
                if (!(sectionKey in additionalData)) {
                    additionalData[sectionKey] = {
                        value: sectionValue,
                        rows: {},
                    };
                }
                if (!(rowKey in additionalData[sectionKey].rows)) {
                    additionalData[sectionKey].rows[rowKey] = {
                        domain: domain,
                        values,
                    };
                }
            }

            return additionalData;
        };

        additionalGroups.push(
            previousWeekSlotsInfo.then((data) => {
                const timesheet_data = data.groups.map((r) => {
                    const d = {};
                    for (const validRowField of validRowFields) {
                        d[validRowField] = r[validRowField];
                    }
                    return d;
                });
                return prepareAdditionalData(timesheet_data);
            })
        );

        return additionalGroups;
    },
});
