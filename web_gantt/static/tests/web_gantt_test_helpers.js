import { hover, queryAll, queryFirst, setInputRange } from "@odoo/hoot-dom";
import { animationFrame, runAllTimers } from "@odoo/hoot-mock";
import { contains, mountView } from "@web/../tests/web_test_helpers";
import { getPickerCell, zoomOut } from "@web/../tests/core/datetime/datetime_test_helpers";

/**
 * @typedef CellHelperOptions
 * @property {number} [part=1] -- starts at 1
 * @property {boolean} [ignoreHoverableClass=false]
 */

/**
 * @typedef PillHelperOptions
 * @property {number} [nth=1] -- starts at 1
 */

/**
 * @typedef DragPillHelpers
 * @property {() => Promise<void>} cancel
 * @property {(params: DragParams) => Promise<void>} drop
 * @property {(params: DragParams) => Promise<void>} moveTo
 */

/**
 * @template T
 * @typedef {(columnHeader: string, rowHeader: string, options: CellHelperOptions) => T} CellHelper
 */

/**
 * @template T
 * @typedef {(text: string, options: PillHelperOptions) => T} PillHelper
 */

/** @typedef {CellHelperOptions & { row: number, column: number }} DragGridParams */

/** @typedef {PillHelperOptions & { pill: string }} DragPillParams */

/** @typedef {DragGridParams | DragPillParams} DragParams */

/**
 * @template {String} T
 * @param {T} key
 * @returns {`.${T}`}
 */
function makeClassSelector(key) {
    return `.${key}`;
}

export const CLASSES = {
    draggable: "o_draggable",
    group: "o_gantt_group",
    highlightedPill: "highlight",
    resizable: "o_resizable",

    // Connectors
    highlightedConnector: "o_connector_highlighted",
    highlightedConnectorCreator: "o_connector_creator_highlight",
    lockedConnectorCreator: "o_connector_creator_lock", // Connector creators highlight for initial pill
};

export const SELECTORS = {
    addButton: ".o_gantt_button_add",
    cell: ".o_gantt_cell",
    cellContainer: ".o_gantt_cells",
    collapseButton: ".o_gantt_button_collapse_rows",
    asc: ".fa-sort-amount-asc",
    desc: ".fa-sort-amount-desc",
    dense: ".fa-compress",
    sparse: ".fa-expand",
    draggable: makeClassSelector(CLASSES.draggable),
    expandButton: ".o_gantt_button_expand_rows",
    expandCollapseButtons: ".o_gantt_button_expand_rows, .o_gantt_button_collapse_rows",
    group: makeClassSelector(CLASSES.group),
    groupHeader: ".o_gantt_header_title",
    columnHeader: ".o_gantt_header_cell",
    highlightedPill: makeClassSelector(CLASSES.highlightedPill),
    hoverable: ".o_gantt_hoverable",
    noContentHelper: ".o_view_nocontent",
    pill: ".o_gantt_pill",
    pillWrapper: ".o_gantt_pill_wrapper",
    progressBar: ".o_gantt_row_header .o_gantt_progress_bar",
    progressBarBackground: ".o_gantt_row_header .o_gantt_progress_bar > span.bg-opacity-25",
    progressBarForeground:
        ".o_gantt_row_header .o_gantt_progress_bar > span > .o_gantt_group_hours",
    progressBarWarning:
        ".o_gantt_row_header .o_gantt_progress_bar > .o_gantt_group_hours > .fa-exclamation-triangle",
    renderer: ".o_gantt_renderer",
    resizable: makeClassSelector(CLASSES.resizable),
    resizeBadge: ".o_gantt_pill_resize_badge",
    resizeEndHandle: ".o_handle_end",
    resizeHandle: ".o_resize_handle",
    resizeStartHandle: ".o_handle_start",
    rowHeader: ".o_gantt_row_header",
    rowTitle: ".o_gantt_row_title",
    rowTotal: ".o_gantt_row_total",
    startDatePicker: ".o_gantt_picker:first-child",
    stopDatePicker: ".o_gantt_picker:last-child",
    thumbnail: ".o_gantt_row_thumbnail",
    todayButton: ".o_gantt_button_today",
    toolbar: ".o_gantt_renderer_controls div[name='ganttToolbar']",
    undraggable: ".o_undraggable",
    view: ".o_gantt_view",
    viewContent: ".o_gantt_view .o_content",

    // Connectors
    connector: ".o_gantt_connector",
    connectorCreatorBullet: ".o_connector_creator_bullet",
    connectorCreatorRight: ".o_connector_creator_right",
    connectorCreatorWrapper: ".o_connector_creator_wrapper",
    connectorRemoveButton: ".o_connector_stroke_remove_button",
    connectorRescheduleButton: ".o_connector_stroke_reschedule_button",
    connectorStroke: ".o_connector_stroke",
    connectorStrokeButton: ".o_connector_stroke_button",
    highlightedConnector: makeClassSelector(CLASSES.highlightedConnector),
};

export async function mountGanttView(params) {
    const gantt = await mountView({ ...params, type: "gantt" });
    await animationFrame();
    return gantt;
}

/**
 * @param {string} selector
 * @param {DateTime} datetime
 */
async function selectDateInDatePicker(selector, datetime) {
    await contains(selector).click();
    await animationFrame();
    for (let i = 0; i < 3; i++) {
        await zoomOut();
    }
    await contains(getPickerCell(datetime.year - (datetime.year % 10))).click();
    await contains(getPickerCell(datetime.year)).click();
    await contains(getPickerCell(datetime.monthShort)).click();
    await contains(getPickerCell(datetime.day, true)).click();
    await animationFrame();
}

/**
 * @param {Object} param0
 * @param {string} param0.startDate
 * @param {string} param0.stopDate
 */
export async function selectGanttRange({ startDate, stopDate }) {
    const { startDatePicker: START_SELECTOR, stopDatePicker: STOP_SELECTOR } = SELECTORS;
    let [currentStart, currentStop] = getTexts(".o_gantt_picker").map((d) =>
        luxon.DateTime.fromFormat(d, "dd MMMM yyyy")
    );
    const start = luxon.DateTime.fromISO(startDate);
    const startOnLeftSide = start <= currentStop;
    if (
        (startOnLeftSide && !start.equals(currentStart)) ||
        (!startOnLeftSide && !start.equals(currentStop))
    ) {
        await selectDateInDatePicker(startOnLeftSide ? START_SELECTOR : STOP_SELECTOR, start);
    }
    [currentStart, currentStop] = getTexts(".o_gantt_picker").map((d) =>
        luxon.DateTime.fromFormat(d, "dd MMMM yyyy")
    );
    const stop = luxon.DateTime.fromISO(stopDate);
    if (
        (startOnLeftSide && !stop.equals(currentStop)) ||
        (!startOnLeftSide && !stop.equals(currentStart))
    ) {
        await selectDateInDatePicker(startOnLeftSide ? STOP_SELECTOR : START_SELECTOR, stop);
    }
}

/**
 * @param {string} selector
 * @returns {string | null}
 */
export function getText(selector) {
    const texts = getTexts(selector);
    return texts.length ? texts[0] : null;
}

/**
 * @param {string} selector
 * @returns {string[]}
 */
export function getTexts(selector) {
    const elements = [];
    if (typeof selector === "string") {
        elements.push(...queryAll(selector));
    } else if (selector[Symbol.iterator]) {
        elements.push(...selector);
    } else {
        elements.push(selector);
    }
    return elements.map((el) => el.innerText.trim().replace(/\n/g, ""));
}

export function getActiveScale() {
    return queryFirst(".o_gantt_renderer_controls input").value;
}

/**
 * @param {Number} scale
 */
export async function setScale(scale) {
    setInputRange(".o_gantt_renderer_controls input", scale);
    await animationFrame();
    await animationFrame(); // for potential focusDate
}

/** @type {PillHelper<Promise<DragPillHelpers>>} */
export async function dragPill(text, options) {
    /** @param {DragParams} params */
    const drop = async (params) => {
        await moveTo(params);
        const res = dragActions.drop();
        await animationFrame();
        return res;
    };

    /** @param {DragParams} params */
    const moveTo = async (params) => {
        let cell;
        if (params?.column) {
            cell = await hoverGridCell(params.column, params.row, params);
        } else if (params?.pill) {
            cell = await hoverPillCell(getPillWrapper(params.pill, params));
        }
        return dragActions.moveTo(cell, {
            position: getCellPositionOffset(cell, params.part),
            relative: true,
        });
    };

    const pill = getPillWrapper(text, options);
    await hoverPillCell(pill);
    const dragActions = await contains(pill).drag();

    return { ...dragActions, drop, moveTo };
}

/** @type {PillHelper<Promise<void>>} */
export async function editPill(text, options) {
    await contains(getPill(text, options)).click();
    await contains(".o_popover .popover-footer .btn-primary").click();
}

/**
 * @param {string} header
 */
function findColumnFromHeader(header) {
    const columnHeaders = getHeaders(SELECTORS.columnHeader);
    const groupHeaders = getHeaders(SELECTORS.groupHeader);
    const columnHeader = header.substring(0, header.indexOf(" "));
    const groupHeader = header.substring(header.indexOf(" ") + 1);
    const groupRange = groupHeaders.find((header) => header.title === groupHeader).range;
    return columnHeaders.find(
        (header) =>
            header.title === columnHeader &&
            header.range[0] >= groupRange[0] &&
            header.range[1] <= groupRange[1]
    ).range[0];
}

/** @type {CellHelper<HTMLElement>} */
export function getCell(columnHeader, rowHeader = null, options) {
    const columnIndex = findColumnFromHeader(columnHeader);
    const cells = queryAll(`${SELECTORS.cell}[data-col='${columnIndex}']`);
    if (!cells.length) {
        throw new Error(`Could not find cell at column ${columnHeader}`);
    }
    if (!rowHeader) {
        return cells[0];
    }
    const row = queryAll(`.o_gantt_row_header:contains(${rowHeader})`)?.[(options?.num || 1) - 1];
    if (!row) {
        throw new Error(`Could not find row ${rowHeader}`);
    }
    const rowId = row.getAttribute("data-row-id");
    return cells.find((cell) => cell.getAttribute("data-row-id") === rowId);
}

/** @type {CellHelper<string[]>} */
export function getCellColorProperties(columnHeader, rowHeader = null, options) {
    const cell = getCell(columnHeader, rowHeader, options);
    const cssVarRegex = /(--[\w-]+)/g;

    if (cell.style.background) {
        return cell.style.background.match(cssVarRegex);
    } else if (cell.style.backgroundColor) {
        return cell.style.backgroundColor.match(cssVarRegex);
    } else if (cell.style.backgroundImage) {
        return cell.style.backgroundImage.match(cssVarRegex);
    }

    return [];
}

/**
 * @param {HTMLElement} pill
 * @returns {HTMLElement}
 */
export function getCellFromPill(pill) {
    if (!pill.matches(SELECTORS.pillWrapper)) {
        pill = pill.closest(SELECTORS.pillWrapper);
    }
    const { row, column } = getGridStyle(pill);
    for (const cell of queryAll(SELECTORS.cell)) {
        const { row: cellRow, column: cellColumn } = getGridStyle(cell);
        if (row[0] < cellRow[1] && column[0] < cellColumn[1]) {
            return cell;
        }
    }
    throw new Error(`Could not find hoverable cell for pill "${getText(pill)}".`);
}

/**
 * @param {string} str
 */
function parseNumber(str) {
    return parseInt(str.match(/\d+/)?.[0]) || 1;
}

/**
 * @param {string} selector
 */
function getHeaders(selector) {
    const groupHeaders = [];
    for (const el of queryAll(selector)) {
        const { column: range } = getGridStyle(el);
        groupHeaders.push({
            range,
            title: el.textContent,
        });
    }
    return groupHeaders;
}

export function getGridContent() {
    const columnHeaders = getHeaders(SELECTORS.columnHeader);
    const groupHeaders = getHeaders(SELECTORS.groupHeader);
    const range = queryFirst(".o_gantt_renderer_controls > div").textContent;
    const viewTitle = getText(".o_gantt_title");
    const colsRange = queryFirst(SELECTORS.columnHeader)
        .style.getPropertyValue("grid-column")
        .split("/");
    const cellParts = parseNumber(colsRange[1]) - parseNumber(colsRange[0]);
    const pillEls = new Set(queryAll(`${SELECTORS.cellContainer} ${SELECTORS.pillWrapper}`));
    const rowEls = [...queryAll(`.o_gantt_row_headers > ${SELECTORS.rowHeader}`)];
    const singleRowMode = rowEls.length === 0;
    if (singleRowMode) {
        rowEls.push(document.createElement("div"));
    }
    const totalRow = queryFirst(SELECTORS.rowTotal);
    const totalPillEls = new Set(queryAll(`.o_gantt_row_total ${SELECTORS.pillWrapper}`));
    if (totalRow) {
        totalRow._isTotal = true;
        rowEls.push(totalRow);
    }
    const rows = [];
    for (const rowEl of rowEls) {
        const isGroup = rowEl.classList.contains(CLASSES.group);
        const { row: gridRow } = getGridStyle(rowEl);
        const row = singleRowMode ? {} : { title: getText(rowEl) };
        if (isGroup) {
            row.isGroup = true;
        }
        if (rowEl._isTotal) {
            row.isTotalRow = true;
        }
        const pills = [];
        for (const pillEl of rowEl._isTotal ? totalPillEls : pillEls) {
            const pillRowLevel = parseNumber(pillEl.style.gridRowStart);
            const { column: gridColumn } = getGridStyle(pillEl);
            const pillInRow = pillRowLevel >= gridRow[0] && pillRowLevel < gridRow[1];
            if (singleRowMode || pillInRow || rowEl._isTotal) {
                let start = columnHeaders.find(
                    (header) => gridColumn[0] >= header.range[0] && gridColumn[0] < header.range[1]
                )?.title;
                let end = columnHeaders.find(
                    (header) => gridColumn[1] > header.range[0] && gridColumn[1] <= header.range[1]
                )?.title;
                const startPart = (gridColumn[0] - 1) % cellParts;
                const endPart = (gridColumn[1] - 1) % cellParts;
                if (startPart && start) {
                    start += ` (${startPart}/${cellParts})`;
                }
                if (endPart && end) {
                    end += ` (${endPart}/${cellParts})`;
                }
                const pill = {
                    title: getText(pillEl),
                    colSpan: `${start || "Out of bounds (" + gridColumn[0] + ")"} ${
                        start
                            ? groupHeaders.find(
                                  (header) =>
                                      gridColumn[0] >= header.range[0] &&
                                      gridColumn[0] < header.range[1]
                              ).title
                            : ""
                    } -> ${end || "Out of bounds (" + gridColumn[1] + ")"} ${
                        end
                            ? groupHeaders.find(
                                  (header) =>
                                      gridColumn[1] > header.range[0] &&
                                      gridColumn[1] <= header.range[1]
                              ).title
                            : ""
                    }`,
                };
                if (!isGroup) {
                    pill.level = singleRowMode ? pillRowLevel - 1 : pillRowLevel - gridRow[0];
                }
                pills.push(pill);
                pillEls.delete(pillEl);
            }
        }
        if (pills.length) {
            row.pills = pills;
        }
        rows.push(row);
    }

    return { columnHeaders, groupHeaders, range, rows, viewTitle };
}

/**
 * @param {HTMLElement} el
 */
export function getGridStyle(el) {
    /**
     * @param {"row" | "column"} prop
     * @returns {[number, number]}
     */
    const getGridProp = (prop) => {
        return [
            parseNumber(style.getPropertyValue(`grid-${prop}-start`)),
            parseNumber(style.getPropertyValue(`grid-${prop}-end`)),
        ];
    };

    const style = getComputedStyle(el);

    return {
        row: getGridProp("row"),
        column: getGridProp("column"),
    };
}

function getCellPositionOffset(cell, part) {
    const position = { x: 1 };
    if (part > 1) {
        const rect = cell.getBoundingClientRect();
        // Calculate cell parts
        const colsRange = queryFirst(SELECTORS.columnHeader)
            .style.getPropertyValue("grid-column")
            .split("/");
        const cellParts = parseNumber(colsRange[1]) - parseNumber(colsRange[0]);
        const partWidth = rect.width / cellParts;
        position.x += Math.ceil(partWidth * (part - 1));
    }
    return position;
}

/**
 * @param {HTMLElement} cell
 * @param {CellHelperOptions} [options]
 */
async function hoverCell(cell, options) {
    const part = options?.part ?? 1;
    hover(cell, { position: getCellPositionOffset(cell, part), relative: true });
    await runAllTimers();
}

/**
 * Hovers a cell found from given grid coordinates.
 * @type {CellHelper<Promise<HTMLElement>>}
 */
export async function hoverGridCell(columnHeader, rowHeader = null, options) {
    const cell = getCell(columnHeader, rowHeader, options);
    await hoverCell(cell, options);
    return cell;
}

/**
 * Click on a cell found from given grid coordinates.
 * @type {CellHelper<Promise<HTMLElement>>}
 */
export async function clickCell(columnHeader, rowHeader = null, options) {
    const cell = getCell(columnHeader, rowHeader, options);
    await contains(cell).click();
}

/**
 * Hovers a cell found from a pill element.
 * @param {HTMLElement} pill
 * @returns {Promise<HTMLElement>}
 */
async function hoverPillCell(pill) {
    const cell = getCellFromPill(pill);
    const pStart = getGridStyle(pill).column[0];
    const cellStyle = getGridStyle(cell).column[0];
    const part = pStart - cellStyle + 1;
    await hoverCell(cell, { part });
    return cell;
}

/**
 * @param {HTMLElement} pill
 * @param {"start" | "end"} side
 * @param {number | { x: number }} deltaOrPosition
 * @param {boolean} [shouldDrop=true]
 */
export async function resizePill(pill, side, deltaOrPosition, shouldDrop = true) {
    hover(pill);

    const { row, column } = getGridStyle(pill);

    // Calculate cell parts
    const colsRange = queryFirst(SELECTORS.columnHeader)
        .style.getPropertyValue("grid-column")
        .split("/");
    const cellParts = parseNumber(colsRange[1]) - parseNumber(colsRange[0]);

    // Calculate delta or position
    const delta = typeof deltaOrPosition === "object" ? 0 : deltaOrPosition;
    const position = typeof deltaOrPosition === "object" ? deltaOrPosition : {};
    const targetColumn = (side === "start" ? column[0] : column[1]) + delta * cellParts;

    let targetCell;
    let targetPart;
    for (const cell of queryAll(SELECTORS.cell)) {
        const { row: cRow, column: cCol } = getGridStyle(cell);
        if (cRow[0] > row[0] || cRow[1] < row[1]) {
            continue;
        }
        if (cCol[1] < targetColumn) {
            continue;
        }

        if (targetColumn < cCol[0]) {
            break;
        }

        targetCell = cell;
        targetPart = targetColumn - cCol[0];
    }

    // Assign position if delta
    if (!position.x) {
        const { width } = targetCell.getBoundingClientRect();
        position.x = targetPart * Math.floor(width / cellParts);
    }

    // Actual drag actions
    const { moveTo, drop } = await contains(
        pill.querySelector(
            side === "start" ? SELECTORS.resizeStartHandle : SELECTORS.resizeEndHandle
        )
    ).drag();

    await moveTo(targetCell, { position, relative: true });

    if (shouldDrop) {
        await drop();
    } else {
        return drop;
    }
}

/** @type {PillHelper<HTMLElement>} */
export function getPill(text, options) {
    const nth = options?.nth ?? 1;
    const regex = new RegExp(text, "i");
    const pill = [...queryAll(SELECTORS.pill)].filter((pill) => regex.test(getText(pill)))[nth - 1];
    if (!pill) {
        throw new Error(`Could not find pill with text "${text}" (nth: ${nth})`);
    }
    return pill;
}

/** @type {PillHelper<HTMLElement>} */
export function getPillWrapper(text, options) {
    return getPill(text, options).closest(SELECTORS.pillWrapper);
}
