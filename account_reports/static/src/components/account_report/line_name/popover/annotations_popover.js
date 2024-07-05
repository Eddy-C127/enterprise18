import { Component, useState, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { DateTimeInput } from "@web/core/datetime/datetime_input";
import { AnnotationPopoverLine } from "@account_reports/components/account_report/line_name/popover_line/annotation_popover_line";

const { DateTime } = luxon;

export class AccountReportAnnotationsPopover extends Component {
    static template = "account_reports.AccountReportAnnotationsPopover";
    static props = {
        controller: Object,
        lineName: Object,
        lineID: String,
        close: { type: Function, optional: true },
        isAddingAnnotation: { type: Boolean, optional: true },
    };
    static components = {
        DateTimeInput,
        AnnotationPopoverLine,
    };

    setup() {
        this.orm = useService("orm");
        this.notificationService = useService("notification");

        this.newAnnotation = useState({
            value: this.props.isAddingAnnotation ? this._getNewAnnotation() : {},
        });

        this.annotations = useState(
            this.props.controller.visibleAnnotations.filter((annotation) => {
                return annotation.line_id === this.props.lineID;
            })
        );

        this.popoverTable = useRef("popoverTable");
    }

    get isAddingAnnotation() {
        return Object.keys(this.newAnnotation.value).length !== 0;
    }

    async refreshAnnotations() {
        await this.props.controller.refreshAnnotations();
        this.annotations = this.props.controller.visibleAnnotations.filter((annotation) => {
            return annotation.line_id === this.props.lineID;
        });
        this.cleanNewAnnotation();
    }

    _getNewAnnotation() {
        const date =
            this.props.controller.options.date.filter === "today"
                ? new Date().toISOString().split("T")[0]
                : this.props.controller.options.date.date_to;
        return {
            date: DateTime.fromISO(date),
            text: "",
            lineID: this.props.lineID,
        };
    }

    cleanNewAnnotation() {
        this.newAnnotation.value = {};
    }

    addAnnotation() {
        this.newAnnotation.value = this._getNewAnnotation();
    }

    formatAnnotation(annotation) {
        return {
            id: annotation.id,
            date: annotation.date ? DateTime.fromISO(annotation.date) : null,
            text: annotation.text,
            lineID: annotation.line_id,
        };
    }

    async saveNewAnnotation(newAnnotation) {
        if (newAnnotation.text) {
            await this.orm.call(
                "account.report.annotation",
                "create",
                [
                    {
                        report_id: this.props.controller.options.report_id,
                        line_id: newAnnotation.lineID,
                        text: newAnnotation.text,
                        date: newAnnotation.date ? newAnnotation.date.toFormat("yyyy-LL-dd") : null,
                        fiscal_position_id: this.props.controller.options.fiscal_position,
                    },
                ],
                {
                    context: this.props.context,
                }
            );
            await this.refreshAnnotations();
            this.popoverTable.el.scrollIntoView({ behavior: "smooth", block: "end" });
        }
    }

    async deleteAnnotation(annotationId) {
        await this.orm.call("account.report.annotation", "unlink", [annotationId], {
            context: this.props.controller.context,
        });
        await this.refreshAnnotations();
    }

    async editAnnotation(editedAnnotation, existingAnnotation) {
        await this.orm.call(
            "account.report.annotation",
            "write",
            [[existingAnnotation.id], { text: editedAnnotation.text, date: editedAnnotation.date }],
            {
                context: this.props.controller.context,
            }
        );
        await this.refreshAnnotations();
    }
}
