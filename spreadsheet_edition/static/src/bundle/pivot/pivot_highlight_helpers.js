import { helpers } from "@odoo/o-spreadsheet";
import { mergeContiguousZones } from "../helpers/zone_helpers";

const { positionToZone } = helpers;

export function getPivotHighlights(getters, pivotId) {
    const sheetId = getters.getActiveSheetId();
    const pivotCellPositions = getVisiblePivotCellPositions(getters, pivotId);
    const mergedZones = mergeContiguousZones(pivotCellPositions.map(positionToZone));
    return mergedZones.map((zone) => ({ sheetId, zone, noFill: true }));
}

function getVisiblePivotCellPositions(getters, pivotId) {
    const positions = [];
    const sheetId = getters.getActiveSheetId();
    for (const col of getters.getSheetViewVisibleCols()) {
        for (const row of getters.getSheetViewVisibleRows()) {
            const position = { sheetId, col, row };
            const cellPivotId = getters.getPivotIdFromPosition(position);
            if (pivotId === cellPivotId) {
                positions.push(position);
            }
        }
    }
    return positions;
}
