/** @odoo-module **/

import { registry } from "@web/core/registry";
import { PivotController } from "@web/views/pivot/pivot_controller";
import { unique } from "@web/core/utils/arrays";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { PERIODS } from "@spreadsheet_edition/assets/helpers";
import { omit } from "@web/core/utils/objects";
import { sprintf } from "@web/core/utils/strings";

import { _t } from "@web/core/l10n/translation";
import { SpreadsheetSelectorDialog } from "@spreadsheet_edition/assets/components/spreadsheet_selector_dialog/spreadsheet_selector_dialog";

import { onWillStart } from "@odoo/owl";

patch(PivotController.prototype, "pivot_spreadsheet", {
    setup() {
        this._super.apply(this, arguments);
        this.userService = useService("user");
        this.notification = useService("notification");
        this.actionService = useService("action");
        onWillStart(async () => {
            const insertionGroups = registry.category("spreadsheet_view_insertion_groups").getAll();
            const userGroups = await Promise.all(
                insertionGroups.map((group) => this.userService.hasGroup(group))
            );
            this.canInsertPivot = userGroups.some((group) => group);
        });
    },

    onInsertInSpreadsheet() {
        let name = this.model.metaData.title;
        const groupBy =
            this.model.metaData.fullColGroupBys[0] || this.model.metaData.fullRowGroupBys[0];
        if (groupBy) {
            let [field, period] = groupBy.split(":");
            period = PERIODS[period];
            if (period) {
                name = sprintf(_t("%(name)s by %(field)s (%(period)s)"), {
                    name,
                    field: this.model.metaData.fields[field].string,
                    period,
                });
            } else {
                name = sprintf(_t("%(name)s by %(field)s"), {
                    name,
                    field: this.model.metaData.fields[field].string,
                });
            }
        }
        const actionOptions = {
            preProcessingAsyncAction: "insertPivot",
            preProcessingAsyncActionData: {
                data: this.model.data,
                metaData: this.model.metaData,
                searchParams: {
                    ...this.model.searchParams,
                    context: omit(
                        this.model.searchParams.context,
                        ...Object.keys(this.userService.context)
                    ),
                },
                name,
            },
        };
        const params = {
            type: "PIVOT",
            name,
            actionOptions,
        };
        this.env.services.dialog.add(SpreadsheetSelectorDialog, params);
    },

    hasDuplicatedGroupbys() {
        const fullColGroupBys = this.model.metaData.fullColGroupBys;
        const fullRowGroupBys = this.model.metaData.fullRowGroupBys;
        if (
            unique(fullColGroupBys).length < fullColGroupBys.length ||
            unique(fullRowGroupBys).length < fullRowGroupBys.length ||
            unique([...fullColGroupBys, ...fullRowGroupBys]).length <
                fullColGroupBys.length + fullRowGroupBys.length
        ) {
            return true;
        }
        return false;
    },

    isInsertButtonDisabled() {
        return (
            !this.model.hasData() ||
            this.model.metaData.activeMeasures.length === 0 ||
            this.model.useSampleModel ||
            this.hasDuplicatedGroupbys()
        );
    },

    getTooltipTextForDuplicatedGroupbys() {
        return _t("Pivot contains duplicate groupbys");
    },
});
