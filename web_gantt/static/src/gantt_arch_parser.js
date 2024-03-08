import { getLocalWeekNumber } from "@web/core/l10n/dates";
import { _t } from "@web/core/l10n/translation";
import { evaluateExpr } from "@web/core/py_js/py";
import { visitXML } from "@web/core/utils/xml";
import { archParseBoolean, getActiveActions } from "@web/views/utils";

const DECORATIONS = [
    "decoration-danger",
    "decoration-info",
    "decoration-secondary",
    "decoration-success",
    "decoration-warning",
];
const ORDERS = ["ASC", "DESC", "asc", "desc", null];
const PARTS = { full: 1, half: 2, quarter: 4 };
const SCALES = {
    day: {
        // determines subcolumns
        cellPrecisions: { full: 60, half: 30, quarter: 15 },
        defaultPrecision: "full",
        time: "minute",
        unitDescription: _t("minutes"),

        // determines columns
        interval: "hour",
        minimalColumnWidth: 40,

        // determines column groups
        unit: "day",
        groupHeaderFormatter: (date) => date.toFormat("dd MMMM yyyy"),

        defaultRange: { unit: "day", count: 3 },
    },
    week: {
        cellPrecisions: { full: 24, half: 12 },
        defaultPrecision: "half",
        time: "hour",
        unitDescription: _t("hours"),

        interval: "day",
        minimalColumnWidth: 192,
        colHeaderFormatter: (date) => date.toFormat("dd"),

        unit: "week",
        groupHeaderFormatter: (date) => date.toFormat(`'W${getLocalWeekNumber(date)}' yyyy`),

        defaultRange: { unit: "week", count: 3 },
    },
    week_2: {
        cellPrecisions: { full: 24, half: 12 },
        defaultPrecision: "half",
        time: "hour",
        unitDescription: _t("hours"),

        interval: "day",
        minimalColumnWidth: 96,
        colHeaderFormatter: (date) => date.toFormat("dd"),

        unit: "week",
        groupHeaderFormatter: (date) => date.toFormat(`'W${getLocalWeekNumber(date)}' yyyy`),

        defaultRange: { unit: "week", count: 6 },
    },
    month: {
        cellPrecisions: { full: 24, half: 12 },
        defaultPrecision: "half",
        time: "hour",
        unitDescription: _t("hours"),

        interval: "day",
        minimalColumnWidth: 50,
        colHeaderFormatter: (date) => date.toFormat("dd"),

        unit: "month",
        groupHeaderFormatter: (date, env) => date.toFormat(env.isSmall ? "MMM yyyy" : "MMMM yyyy"),

        defaultRange: { unit: "month", count: 3 },
    },
    month_3: {
        cellPrecisions: { full: 24, half: 12 },
        defaultPrecision: "half",
        time: "hour",
        unitDescription: _t("hours"),

        interval: "day",
        minimalColumnWidth: 18,
        colHeaderFormatter: (date) => date.toFormat("dd"),

        unit: "month",
        groupHeaderFormatter: (date, env) => date.toFormat(env.isSmall ? "MMM yyyy" : "MMMM yyyy"),

        defaultRange: { unit: "month", count: 6 },
    },
    year: {
        cellPrecisions: { full: 1 },
        defaultPrecision: "full",
        time: "month",
        unitDescription: _t("months"),

        interval: "month",
        minimalColumnWidth: 60,
        colHeaderFormatter: (date, env) => date.toFormat(env.isSmall ? "MMM" : "MMMM"),

        unit: "year",
        groupHeaderFormatter: (date) => date.toFormat("yyyy"),

        defaultRange: { unit: "year", count: 1 },
    },
};

export class GanttArchParser {
    parse(arch) {
        let infoFromRootNode;
        const decorationFields = [];
        let popoverTemplate = null;

        visitXML(arch, (node) => {
            switch (node.tagName) {
                case "gantt": {
                    infoFromRootNode = getInfoFromRootNode(node);
                    break;
                }
                case "field": {
                    const fieldName = node.getAttribute("name");
                    decorationFields.push(fieldName);
                    break;
                }
                case "templates": {
                    popoverTemplate = node.querySelector("[t-name=gantt-popover]") || null;
                    if (popoverTemplate) {
                        popoverTemplate.removeAttribute("t-name");
                    }
                }
            }
        });

        return {
            ...infoFromRootNode,
            decorationFields,
            popoverTemplate,
        };
    }
}

function getInfoFromRootNode(rootNode) {
    const attrs = {};
    for (const { name, value } of rootNode.attributes) {
        attrs[name] = value;
    }

    const { create: canCreate, delete: canDelete, edit: canEdit } = getActiveActions(rootNode);
    const canCellCreate = archParseBoolean(attrs.cell_create, true) && canCreate;
    const canPlan = archParseBoolean(attrs.plan, true) && canEdit;

    let consolidationMaxField;
    let consolidationMaxValue;
    const consolidationMax = attrs.consolidation_max ? evaluateExpr(attrs.consolidation_max) : {};
    if (Object.keys(consolidationMax).length > 0) {
        consolidationMaxField = Object.keys(consolidationMax)[0];
        consolidationMaxValue = consolidationMax[consolidationMaxField];
    }

    const consolidationParams = {
        excludeField: attrs.consolidation_exclude,
        field: attrs.consolidation,
        maxField: consolidationMaxField,
        maxValue: consolidationMaxValue,
    };

    const dependencyField = attrs.dependency_field || null;
    const dependencyEnabled = !!dependencyField;
    const dependencyInvertedField = attrs.dependency_inverted_field || null;

    const allowedScales = [];
    if (attrs.scales) {
        for (const key of attrs.scales.split(",")) {
            if (SCALES[key]) {
                allowedScales.push(key);
            }
        }
    }
    if (allowedScales.length === 0) {
        allowedScales.push(...Object.keys(SCALES));
    }

    // Cell precision
    const cellPrecisions = {};

    // precision = {'day': 'hour:half', 'week': 'day:half', 'month': 'day', 'year': 'month:quarter'}
    const precisionAttrs = attrs.precision ? evaluateExpr(attrs.precision) : {};
    for (const scaleId in SCALES) {
        if (precisionAttrs[scaleId]) {
            const precision = precisionAttrs[scaleId].split(":"); // hour:half
            // Note that precision[0] (which is the cell interval) is not
            // taken into account right now because it is no customizable.
            if (
                precision[1] &&
                Object.keys(SCALES[scaleId].cellPrecisions).includes(precision[1])
            ) {
                cellPrecisions[scaleId] = precision[1];
            }
        }
        cellPrecisions[scaleId] ||= SCALES[scaleId].defaultPrecision;
    }

    const scales = {};
    for (const scaleId of allowedScales) {
        const precision = cellPrecisions[scaleId];
        const referenceScale = SCALES[scaleId];
        scales[scaleId] = {
            ...referenceScale,
            cellPart: PARTS[precision],
            cellTime: referenceScale.cellPrecisions[precision],
            id: scaleId,
            unitDescription: referenceScale.unitDescription.toString(),
        };
        // protect SCALES content
        delete scales[scaleId].cellPrecisions;
    }

    let pillDecorations = null;
    for (const decoration of DECORATIONS) {
        if (decoration in attrs) {
            if (!pillDecorations) {
                pillDecorations = {};
            }
            pillDecorations[decoration] = attrs[decoration];
        }
    }

    return {
        canCellCreate,
        canCreate,
        canDelete,
        canEdit,
        canPlan,
        colorField: attrs.color,
        computePillDisplayName: !!attrs.pill_label,
        consolidationParams,
        createAction: attrs.on_create || null,
        dateStartField: attrs.date_start,
        dateStopField: attrs.date_stop,
        defaultGroupBy: attrs.default_group_by ? attrs.default_group_by.split(",") : [],
        defaultScale: attrs.default_scale || "month",
        dependencyEnabled,
        dependencyField,
        dependencyInvertedField,
        disableDrag: archParseBoolean(attrs.disable_drag_drop),
        displayMode: attrs.display_mode || "dense",
        displayTotalRow: archParseBoolean(attrs.total_row),
        displayUnavailability: archParseBoolean(attrs.display_unavailability),
        formViewId: attrs.form_view_id ? parseInt(attrs.form_view_id, 10) : false,
        offset: attrs.offset,
        order: attrs.order && ORDERS.includes(attrs.order) ? attrs.order.toUpperCase() : null,
        pagerLimit: attrs.groups_limit ? parseInt(attrs.groups_limit, 10) : null,
        pillDecorations,
        progressBarFields: attrs.progress_bar ? attrs.progress_bar.split(",") : null,
        progressField: attrs.progress || null,
        scales,
        string: attrs.string || _t("Gantt View").toString(),
        thumbnails: attrs.thumbnails ? evaluateExpr(attrs.thumbnails) : {},
    };
}
