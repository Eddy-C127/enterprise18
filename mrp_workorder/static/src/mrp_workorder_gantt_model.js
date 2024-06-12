import { formatPercentage } from "@web/views/fields/formatters";
import { GanttModel } from "@web_gantt/gantt_model";

export class MRPWorkorderGanttModel extends GanttModel {

    /**
     * @override
     */
    _addProgressBarInfo(_, rows) {
        super._addProgressBarInfo(...arguments);
        for (const row of rows) {
            if (row.progressBar) {
                row.progressBar.ratio_formatted = formatPercentage(row.progressBar.ratio / 100);
            }
        }
    }
}
