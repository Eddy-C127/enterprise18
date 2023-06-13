/** @odoo-module **/

import { Field } from "@web/views/fields/field";
import { TimesheetDisplayTimer } from "../timesheet_display_timer/timesheet_display_timer";
import { useService, useAutofocus } from "@web/core/utils/hooks";
import { Component, onWillStart, onWillUpdateProps } from "@odoo/owl";

export class TimesheetTimerHeader extends Component {
    static template = "timesheet_grid.TimesheetTimerHeader";
    static components = {
        TimesheetDisplayTimer,
        Field,
    };
    static props = {
        timesheet: { type: Object, optional: true },
        stepTimer: Number,
        timerRunning: Boolean,
        addTimeMode: Boolean,
        fields: { type: Object, optional: true },
        headerReadonly: { type: Boolean, optional: true },
        timerService: { type: Object, optional: true },
        onTimerStarted: Function,
        onTimerStopped: Function,
        onTimerUnlinked: Function,
        className: { type: String, optional: true },
    };

    setup() {
        this.orm = useService("orm");
        onWillStart(async () => await this.onWillStart());
        onWillUpdateProps((nextProps) => this.onWillUpdateProps(nextProps));
        useAutofocus({ refName: "startButton" });
        useAutofocus({ refName: "stopButton" });
    }

    async onWillStart() {
        if (this.props.timesheet && this.props.timesheet.data.name === "/") {
            this._clearTimesheetName();
        }
    }

    onWillUpdateProps(nextProps) {
        if (nextProps.timesheet && nextProps.timesheet.data.name === "/") {
            this._clearTimesheetName(nextProps.timesheet);
        }
    }

    //----------------------------------------------------------------------
    // Getters
    //----------------------------------------------------------------------

    get _addTimeMode() {
        return this.props.addTimeMode;
    }

    get _timerIsRunning() {
        return this.props.timerRunning;
    }

    get _headerReadonly() {
        return this.props.headerReadonly;
    }

    get isMobile() {
        return this.env.isSmall;
    }

    //--------------------------------------------------------------------------
    // Business Methods
    //--------------------------------------------------------------------------

    _clearTimesheetName(timesheet = null) {
        (timesheet || this.props.timesheet).update({ name: "" }, { silent: true });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    async _onClickStartTimer(ev) {
        await this.props.onTimerStarted();
    }

    async _onClickStopTimer(ev) {
        if (await this.props.timesheet.save()) {
            await this.props.onTimerStopped();
        }
    }

    async _onClickUnlinkTimer(ev) {
        await this.props.onTimerUnlinked();
    }
}
