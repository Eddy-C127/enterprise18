/** @odoo-module **/

import { patchWithCleanup, nextTick } from "@web/../tests/helpers/utils";
import { createWebClient, doAction } from "@web/../tests/webclient/helpers";
import { start } from "@mail/../tests/helpers/test_utils";
import {
    prepareWebClientForSpreadsheet,
    getSpreadsheetActionModel,
    getSpreadsheetActionEnv,
} from "@spreadsheet_edition/../tests/utils/webclient_helpers";
import { SpreadsheetTestAction } from "../../src/spreadsheet_test_action";
import { VersionHistoryAction } from "@spreadsheet_edition/bundle/actions/version_history/version_history_action";

import { getDummyBasicServerData } from "./data";

/**
 * @typedef {import("@spreadsheet/../tests/utils/data").ServerData} ServerData

 * @typedef {object} SpreadsheetTestParams
 * @property {number} [spreadsheetId]
 * @property {ServerData} [serverData] Data to be injected in the mock server
 * @property {Function} [mockRPC] Mock rpc function
 * @property {boolean} [fromSnapshot]
 */

/**
 * @param {string} actionTag Action tag ("spreadsheet_test_action" or "action_open_spreadsheet_history")
 * @param {SpreadsheetTestParams} params
 */
export async function createSpreadsheetTestAction(actionTag, params = {}) {
    /** @type {any} */
    let spreadsheetAction;
    let { webClient } = params;
    const SpreadsheetActionComponent =
        actionTag === "spreadsheet_test_action" ? SpreadsheetTestAction : VersionHistoryAction;
    patchWithCleanup(SpreadsheetActionComponent.prototype, {
        setup() {
            super.setup();
            spreadsheetAction = this;
        },
    });

    const serverData = params.serverData || getDummyBasicServerData();

    if (!webClient) {
        await prepareWebClientForSpreadsheet();
        webClient = await createWebClient({
            serverData,
            mockRPC: params.mockRPC,
        });
    }

    let spreadsheetId = params.spreadsheetId;
    if (!spreadsheetId) {
        spreadsheetId = createNewDummySpreadsheet(serverData);
    }
    await doAction(
        webClient,
        {
            type: "ir.actions.client",
            tag: actionTag,
            params: {
                spreadsheet_id: spreadsheetId,
                res_model: "spreadsheet.test",
                from_snapshot: params.fromSnapshot,
                thread_id: params.threadId,
            },
        },
        { clearBreadcrumbs: true } // Sometimes in test defining custom action, Odoo opens on the action instead of opening on root
    );
    await nextTick();
    return {
        model: getSpreadsheetActionModel(spreadsheetAction),
        env: getSpreadsheetActionEnv(spreadsheetAction),
    };
}

/**
 *
 * @param {ServerData} serverData
 * @param {object} [data] spreadsheet data
 * @returns {number}
 */
export function createNewDummySpreadsheet(serverData, data) {
    const spreadsheetDummy = serverData.models["spreadsheet.test"].records;
    const maxId = spreadsheetDummy.length ? Math.max(...spreadsheetDummy.map((d) => d.id)) : 0;
    const spreadsheetId = maxId + 1;
    spreadsheetDummy.push({
        id: spreadsheetId,
        name: "Untitled Dummy Spreadsheet",
        spreadsheet_data: data ? JSON.stringify(data) : "{}",
    });
    return spreadsheetId;
}

export async function setupWithThreads(workbookdata = {}, thread) {
    const { pyEnv, webClient } = await start();
    const spreadsheetId = pyEnv["spreadsheet.test"].create({
        name: "Untitled Dummy Spreadsheet",
        spreadsheet_data: JSON.stringify(workbookdata),
    });

    const result = await createSpreadsheetTestAction("spreadsheet_test_action", {
        webClient,
        spreadsheetId,
    });
    return { ...result, pyEnv, spreadsheetId };
}

export async function createThread(model, pyEnv, threadPosition, messages = []) {
    const [spreadsheetId] = pyEnv["spreadsheet.test"].search([], { limit: 1 });
    const threadId = pyEnv["spreadsheet.cell.thread"].create({
        dummy_id: spreadsheetId,
    });
    messages.forEach((msg) =>
        pyEnv["mail.message"].create({
            body: `<p>${msg}</p>`,
            model: "spreadsheet.cell.thread",
            res_id: threadId,
        })
    );
    const result = model.dispatch("ADD_COMMENT_THREAD", { ...threadPosition, threadId });
    await nextTick();
    return result;
}
