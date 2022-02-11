/** @odoo-module */

import spreadsheet from "@documents_spreadsheet_bundle/o_spreadsheet/o_spreadsheet_extended";
import { waitForEvaluation } from "../spreadsheet_test_utils";

const { toCartesian, toZone } = spreadsheet.helpers;

/**
 * Select a cell
 */
export function selectCell(model, xc) {
    return setSelection(model, xc);
}

/**
 * Add a global filter and ensure the data sources are completely reloaded
 */
export async function addGlobalFilter(model, filter) {
    const result = model.dispatch("ADD_GLOBAL_FILTER", filter);
    await waitForEvaluation(model);
    return result;
}

/**
 * Remove a global filter and ensure the data sources are completely reloaded
 */
export async function removeGlobalFilter(model, id) {
    const result = model.dispatch("REMOVE_GLOBAL_FILTER", { id });
    await waitForEvaluation(model);
    return result;
}

/**
 * Edit a global filter and ensure the data sources are completely reloaded
 */
export async function editGlobalFilter(model, filter) {
    const result = model.dispatch("EDIT_GLOBAL_FILTER", filter);
    await waitForEvaluation(model);
    return result;
}

/**
 * Set the value of a global filter and ensure the data sources are completely
 * reloaded
 */
export async function setGlobalFilterValue(model, payload) {
    const result = model.dispatch("SET_GLOBAL_FILTER_VALUE", payload);
    await waitForEvaluation(model);
    return result;
}

/**
 * Set the selection
 */
export function setSelection(model, xc) {
    const zone = toZone(xc);
    const anchor = [zone.left, zone.top];
    model.dispatch("SET_SELECTION", {
        anchorZone: zone,
        anchor,
        zones: [zone],
    });
}

/**
 * Autofill from a zone to a cell
 */
export function autofill(model, from, to) {
    setSelection(model, from);
    const [col, row] = toCartesian(to);
    model.dispatch("AUTOFILL_SELECT", { col, row });
    model.dispatch("AUTOFILL");
}

/**
 * Set the content of a cell
 */
export function setCellContent(model, xc, content, sheetId = undefined) {
    if (sheetId === undefined) {
        sheetId =
            model.config.mode === "headless"
                ? model.getters.getVisibleSheets()[0]
                : model.getters.getActiveSheetId();
    }
    const [col, row] = toCartesian(xc);
    model.dispatch("UPDATE_CELL", { col, row, sheetId, content });
}
