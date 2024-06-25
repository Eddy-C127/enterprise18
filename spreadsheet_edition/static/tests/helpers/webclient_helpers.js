import { Spreadsheet } from "@odoo/o-spreadsheet";
import { SpreadsheetComponent } from "@spreadsheet/actions/spreadsheet_component";
import { makeFakeSpreadsheetService } from "@spreadsheet_edition/../tests/helpers/collaborative_helpers";
import { InsertListSpreadsheetMenu } from "@spreadsheet_edition/assets/list_view/insert_list_spreadsheet_menu_owl";
import { mockService, serverState } from "@web/../tests/web_test_helpers";
import { loadJS } from "@web/core/assets";
import { registry } from "@web/core/registry";

export async function prepareWebClientForSpreadsheet() {
    await loadJS("/web/static/lib/Chart/Chart.js");
    // ADRM TODO have a look on how to do this when converting other modules (this is never called in spreadheet_edition)
    serverState.userContext.hasGroup = async () => true;
    // // patchUserWithCleanup({ hasGroup: async () => true });
    mockService("spreadsheet_collaborative", makeFakeSpreadsheetService());

    registry.category("favoriteMenu").add(
        "insert-list-spreadsheet-menu",
        {
            Component: InsertListSpreadsheetMenu,
            groupNumber: 4,
            isDisplayed: ({ config, isSmall }) =>
                !isSmall &&
                config.actionType === "ir.actions.act_window" &&
                config.viewType === "list",
        },
        { sequence: 5 }
    );
}

function getChildFromComponent(component, cls) {
    return Object.values(component.__owl__.children).find((child) => child.component instanceof cls)
        .component;
}

/**
 * Return the odoo spreadsheet component
 * @param {*} actionManager
 * @returns {SpreadsheetComponent}
 */
export function getSpreadsheetComponent(actionManager) {
    return getChildFromComponent(actionManager, SpreadsheetComponent);
}

/**
 * Return the o-spreadsheet component
 * @param {*} actionManager
 * @returns {Component}
 */
export function getOSpreadsheetComponent(actionManager) {
    return getChildFromComponent(getSpreadsheetComponent(actionManager), Spreadsheet);
}

/**
 * Return the o-spreadsheet Model
 */
export function getSpreadsheetActionModel(actionManager) {
    return getOSpreadsheetComponent(actionManager).model;
}

export function getSpreadsheetActionTransportService(actionManager) {
    return actionManager.transportService;
}

export function getSpreadsheetActionEnv(actionManager) {
    const component = getSpreadsheetComponent(actionManager);
    const oComponent = getOSpreadsheetComponent(actionManager);
    return Object.assign(Object.create(component.env), oComponent.env);
}
