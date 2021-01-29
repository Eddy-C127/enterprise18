 odoo.define("documents_spreadsheet.pivot_utils", function (require) {
    "use strict";

    /**
     * @typedef {Object} Pivot
     * @property {(PivotCache|{})} cache
     * @property {Array<string>} colGroupBys
     * @property {Object} context
     * @property {Array} domain
     * @property {Array<string>} measures
     * @property {string} model
     * @property {Array<string>} rowGroupBys
     */

    const core = require("web.core");
    const _t = core._t;
    const PivotCache = require("documents_spreadsheet.pivot_cache");
    const { Model } = require("documents_spreadsheet.spreadsheet");

    const formats = {
        "day": { in: "DD MMM YYYY", out: "DD/MM/YYYY", display: "DD MMM YYYY", interval: "d" },
        "week": { in: "[W]W YYYY", out: "WW/YYYY", display: "[W]W YYYY", interval: "w" },
        "month": { in: "MMMM YYYY", out: "MM/YYYY", display: "MMMM YYYY", interval: "M" },
        "quarter": { in: "Q YYYY", out: "Q/YYYY", display: "[Q]Q YYYY", interval: "Q" },
        "year": { in: "YYYY", out: "YYYY", display: "YYYY", interval: "y" },
    }

    const periods = {
        "day": _t("Day"),
        "week": _t("Week"),
        "month": _t("Month"),
        "quarter": _t("Quarter"),
        "year": _t("Year"),
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Create the cache of the given pivot
     *
     * @param {Pivot} pivot
     * @param {Function} rpc Rpc function to use
     * @param {Object} params
     * @param {boolean} params.dataOnly fetch only read_group data if possible
     * @param {boolean} params.initialDomain=false only refresh the data with the domain of the pivot,
     *                                      without the global filters
     */
    async function createPivotCache(pivot, rpc, { dataOnly = false, initialDomain = false } = {}) {
        const domain = (!initialDomain && pivot.computedDomain) || pivot.domain;
        const readGroupRPC = rpc({
            model: pivot.model,
            method: "read_group",
            context: pivot.context,
            domain,
            fields: pivot.measures.map((elt) =>
                elt.field === "__count" ? elt.field : elt.field + ":" + elt.operator
            ),
            groupBy: pivot.rowGroupBys.concat(pivot.colGroupBys),
            lazy: false,
        });
        const fieldsPromise = _fetchFields(rpc, pivot, { forceRefetch: !dataOnly })
        const modelNamePromise = _fetchModelName(rpc, pivot, { forceRefetch: !dataOnly });
        const resultGB = await readGroupRPC;
        const resultFG = await fieldsPromise;
        const resultSR = await modelNamePromise;
        pivot.cache = await _createCache(resultGB, resultFG, resultSR, pivot, rpc);
    }

    /**
     * Returns all fields descriptions of the pivot model
     * @param {Function} rpc
     * @param {Pivot} pivot
     * @param {Object} params
     * @param {boolean} params.forceRefetch
     * @returns {Promise<Array<Object>>}
     */
    async function _fetchFields(rpc, pivot, { forceRefetch }) {
        if (!forceRefetch && pivot.cache && Object.keys(pivot.cache).length !== 0) {
            return pivot.cache.getFields();
        }
        else {
            return rpc({
                model: pivot.model,
                method: "fields_get",
            });
        }
    }

    /**
     * Returns the pivot model display name
     * @param {Function} rpc
     * @param {Pivot} pivot
     * @param {Object} params
     * @param {boolean} params.forceRefetch
     * @returns {Promise<string>}
     */
    async function _fetchModelName(rpc, pivot, { forceRefetch }) {
        if (!forceRefetch && pivot.cache) {
            return pivot.cache.getModelLabel();
        }
        else {
            const result = await rpc({
                model: "ir.model",
                method: "search_read",
                fields: ["name"],
                domain: [["model", "=", pivot.model]],
            });
            return result[0] && result[0].name;
        }
    }
    /**
     * Fill the cache of the pivot object given
     *
     * @private
     * @param {Pivot} pivot Pivot object
     * @param {Function} rpc Rpc function to use
     * @param {Object} params
     * @param {boolean} params.dataOnly=false only refresh the data, not the structure of the pivot
     * @param {boolean} params.force=false Force to refresh the cache
     * @param {boolean} params.initialDomain=false only refresh the data with the domain of the pivot,
     *                                      without the global filters
     */
    async function fetchCache(pivot, rpc, { dataOnly = false, force = false, initialDomain = false } = {}) {
        if (force) {
            pivot.lastUpdate = undefined;
        }
        if (!pivot.lastUpdate) {
            pivot.lastUpdate = Date.now();
            pivot.promise = createPivotCache(pivot, rpc,  { dataOnly, initialDomain });
        }
        await pivot.promise;
    }
    /**
     * Fetch the labels which do not exist on the cache (it could happen for
     * exemple in multi-company).
     * It also update the cache to avoid further rpc.
     *
     * @param {Pivot} pivot
     * @param {Function} rpc Rpc function to use
     * @param {string} field Name of the field
     * @param {string} value Value
     *
     * @returns {Promise<string>}
     */
    async function fetchLabel(pivot, rpc, field, value) {
        const model = pivot.cache.getField(field).relation;
        const label = rpc({
            model,
            method: 'name_get',
            args: [parseInt(value, 10)],
        }).then((result) => result && result[0] && result[0][1] || undefined);
        pivot.cache = pivot.cache.withLabel(field, value, label);
        return pivot.cache.getGroupLabel(field, value);
    }

    /**
     * Format a data
     *
     * @param {string} field fieldName:interval
     * @param {string} value
     */
    function formatDate(field, value) {
        const interval = field.split(":")[1];
        const output = formats[interval].display;
        const input = formats[interval].out;
        const date = moment(value, input);
        return date.isValid() ? date.format(output) : _t("(Undefined)");
    }
    /**
     * Format the given groupby
     * @param {Pivot} pivot
     * @param {string} gp Groupby to format
     *
     * @returns groupby formatted
     */
    function formatGroupBy(pivot, gp) {
        if (!pivot.isLoaded) {
            return gp;
        }
        let [name, period] = gp.split(":");
        period = periods[period];
        return pivot.cache.getField(name).string + (period ? ` (${period})` : "");
    }
    /**
     * Format a header value
     *
     * @param {Pivot} pivot
     * @param {string} groupBy e.g. stage_id, create_date:month
     * @param {string} value Value
     */
    function formatHeader(pivot, groupBy, value) {
        if (groupBy === "measure") {
            if (value === "__count") {
                return _t("Count");
            }
            return pivot.cache.getField(value).string
        }
        if (["date", "datetime"].includes(pivot.cache.getField(groupBy.split(":")[0]).type)) {
            return formatDate(groupBy, value);
        }
        return pivot.cache.getGroupLabel(groupBy, value);
    }
    /**
     * Create the pivot object
     *
     * @param {Object} payload Pivot payload (See PivotModel)
     *
     * @returns {Pivot}
     */
    function sanitizePivot(payload) {
        let measures = _sanitizeFields(payload.measures, payload.fields);
        measures = payload.measures.map((measure) => {
            const fieldName = measure.split(":")[0];
            const fieldDesc = payload.fields[fieldName];
            const operator = (fieldDesc.group_operator && fieldDesc.group_operator.toLowerCase()) || "sum";
            return {
                field: measure,
                operator,
            };
        });
        const rowGroupBys = _sanitizeFields(payload.rowGroupBys, payload.fields);
        const colGroupBys = _sanitizeFields(payload.colGroupBys, payload.fields);
        return {
            model: payload.modelName,
            rowGroupBys,
            colGroupBys,
            measures,
            domain: payload.domain,
            context: payload.context,
        };
    }

    /**
     * Takes a template id as input, will convert the formulas
     * from relative to absolute in a way that they can be used to create a sheet.
     * @param {Function} rpc
     * @param {number} templateId
     * @returns {Promise<Object>} spreadsheetData
     */
    async function getDataFromTemplate(rpc, templateId) {
        let [{ data }] = await rpc({
            method: "read",
            model: "spreadsheet.template",
            args: [templateId, ["data"]],
        });
        data = JSON.parse(atob(data));
        const model = new Model(data, {
            mode: "headless",
            evalContext: {
                env: {
                    services: { rpc },
                },
            }
        });
        await Promise.all(model.getters.getPivots().map((pivot) => fetchCache(pivot, rpc, {
            initialDomain: true,
            force: true
        })));
        model.dispatch("CONVERT_PIVOT_FROM_TEMPLATE");
        return model.exportData();
    }


    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Create a cache for the given pivot from the result of the rpcs
     * (read_group, fields_get, search_read)
     *
     * @param {Object} readGroupResult Result of the read_group rpc
     * @param {Object} fieldsGetResult Result of the fields_get rpc
     * @param {string} modelLabel
     * @param {Pivot} pivot Pivot object
     * @param {Function} rpc
     *
     * @private
     * @returns {PivotCache} Cache for pivot object
     */
    async function _createCache(readGroupResult, fieldsGetResult, modelLabel, pivot, rpc) {
        const groupBys = {};
        const labels = {};
        const values = [];

        const fieldNames = pivot.rowGroupBys.concat(pivot.colGroupBys);
        for (let fieldName of fieldNames) {
            labels[fieldName] = {};
        }

        for (let readGroup of readGroupResult) {
            const value = {};
            for (let measure of pivot.measures) {
                const field = measure.field;
                value[field] = readGroup[field];
            }
            value["count"] = readGroup["__count"];
            const index = values.push(value) - 1;
            for (let fieldName of fieldNames) {
                const { label, id } = _formatValue(
                    fieldName,
                    readGroup[fieldName],
                    fieldsGetResult
                );
                labels[fieldName][id] = label;
                let groupBy = groupBys[fieldName] || {};
                let vals = groupBy[id] || [];
                vals.push(index);
                groupBy[id] = vals;
                groupBys[fieldName] = groupBy;
            }
        }
        const orderedValues = await _getOrderedValues(pivot, groupBys, fieldsGetResult, rpc);
        const orderedMeasureIds = {};
        for (const fieldName of fieldNames) {
            orderedMeasureIds[fieldName] = orderedValues[fieldName]
                ? orderedValues[fieldName].map((value) => [value, groupBys[fieldName][value] || []])
                : [];
        }

        const measures = pivot.measures.map((m) => m.field);
        const rows = _createRows(pivot.rowGroupBys, orderedMeasureIds);
        const cols = _createCols(pivot.colGroupBys, orderedMeasureIds, measures);
        const colStructure = pivot.colGroupBys.slice();
        colStructure.push("measure");
        return new PivotCache({
            cols,
            colStructure,
            fields: fieldsGetResult,
            orderedMeasureIds,
            labels,
            modelLabel,
            rows,
            values,
        });
    }

    /**
     * Return all possible values for each grouped field. Values are ordered according
     * to the read group result.
     * e.g.
     *  {
     *      field1: [value1, value2, value3],
     *      field2: [value1, value2],
     *  }
     * @param {Object} params rpc params
     * @param {string} params.model model name
     * @param {Object} params.context
     * @param {Object} groupBys
     * @param {Object} fields
     * @param {Function} rpc
     * @returns {Object}
     */
    async function _getOrderedValues({ model, context }, groupBys, fields, rpc) {
        return Object.fromEntries(
            await Promise.all(
                Object.entries(groupBys).map(async ([groupBy, measures]) => {
                    const [fieldName, aggregationFunction] = groupBy.split(":");
                    const field = fields[fieldName];
                    let values = Object.keys(measures);
                    const hasUndefined = values.includes("false");
                    values = ["date", "datetime"].includes(field.type)
                        ? _orderDateValues(values.filter((value) => value !== "false"), aggregationFunction)
                        : await _orderValues(values, fieldName, field, model, context, rpc);
                    if (hasUndefined && field.type !== "boolean") {
                        values.push("false");
                    }
                    return [groupBy, values];
                })
            )
        );
    }

    /**
     * Sort date and datetime aggregated values.
     * @param {Array<string>} values
     * @param {string} aggregationFunction
     * @returns {Array<string>}
     */
    function _orderDateValues(values, aggregationFunction) {
        return aggregationFunction === "quarter"
            ? values.sort()
            : values
                  .map((value) => moment(value, formats[aggregationFunction].out))
                  .sort((a, b) => a - b)
                  .map((value) => value.format(formats[aggregationFunction].out));
    }

    /**
     * Order values according to a search_read result.
     * @param {Array} values
     * @param {string} fieldName
     * @param {Object} field
     * @param {string} model
     * @param {Object} context
     * @param {Function} rpc
     * @returns {Array}
     */
    async function _orderValues(values, fieldName, field, model, context, rpc) {
        const requestField = field.relation ? "id" : fieldName;
        values = ["boolean", "many2one", "integer", "float"].includes(field.type)
            ? values.map((value) => JSON.parse(value))
            : values;
        const records = await rpc({
            model: field.relation ? field.relation : model,
            domain: [[requestField, "in", values]],
            context,
            method: "search_read",
            fields: [requestField],
            // orderby is omitted for relational fields on purpose to have the default order of the model
            orderBy: field.relation ? false : [{name: fieldName, asc: true}]
        });
        return [...new Set(records.map((record) => record[requestField].toString()))];
    }
    /**
     * Create the columns structure
     *
     * @param {Array<string>} groupBys Name of the fields of colGroupBys
     * @param {Object} values Values of the pivot (see PivotCache.groupBys)
     * @param {Array<string>} measures Measures
     *
     * @private
     * @returns {Array<Array<Array<string>>>} cols
     */
    function _createCols(groupBys, values, measures) {
        const cols = [];
        if (groupBys.length !== 0) {
            _fillColumns(cols, [], [], groupBys, measures, values, false);
        }
        for (let field of measures) {
            cols.push([[], [field]]); // Total
        }
        return cols;
    }
    /**
     * Create the rows structure
     *
     * @param {Array<string>} groupBys Name of the fields of rowGroupBys
     * @param {Object} values Values of the pivot (see PivotCache.groupBys)
     *
     * @private
     * @returns {Array<Array<string>>} rows
     */
    function _createRows(groupBys, values) {
        const rows = [];
        _fillRows(rows, [], groupBys, values, false);
        rows.push([]); // Total
        return rows;
    }
    /**
     * Retrieves the id and the label of a field/value. It also convert dates
     * to non-locale version (i.e. March 2020 => 03/2020)
     *
     * @param {string} fieldDesc Field (create_date:month)
     * @param {string} value Value
     * @param {Object} fieldsGetResult Result of a field_get rpc
     *
     * @private
     * @returns {Object} Label and id formatted
     */
    function _formatValue(fieldDesc, value, fieldsGetResult) {
        const [ fieldName, group ] = fieldDesc.split(":");
        const field = fieldsGetResult[fieldName];
        let id;
        let label;
        if (value instanceof Array) {
            id = value[0];
            label = value[1];
        } else {
            id = value;
            label = value;
        }
        if (field && field.type === "selection") {
            const selection = field.selection.find(x => x[0] === id);
            label = selection && selection[1];
        }
        if (field && ["date", "datetime"].includes(field.type) && group && value) {
            const fIn = formats[group]["in"];
            const fOut = formats[group]["out"];
            const date = moment(value, fIn)
            id = date.isValid() ? date.format(fOut) : false;
            label = id;
        }
        return { label, id };
    }
    /**
     * Get the intersection of two arrays
     *
     * @param {Array} a
     * @param {Array} b
     *
     * @private
     * @returns {Array} intersection between a and b
     */
    function _intersect(a, b) {
        return a.filter((x) => b.includes(x));
    }
    /**
     * fill the columns structure
     *
     * @param {Array} cols Columns to fill
     * @param {Array} currentRow Current value of a row
     * @param {Array} currentCol Current value of a col
     * @param {Array<string>} groupBys Name of the fields of colGroupBys
     * @param {Array<string>} measures Measures
     * @param {Object} values Values of the pivot (see PivotCache.groupBys)
     * @param {Array<number|false} currentIds Ids used to compute the intersection
     *
     * @private
     */
    function _fillColumns(cols, currentRow, currentCol, groupBys, measures, values, currentIds) {
        const field = groupBys[0];
        if (!field) {
            for (let measure of measures) {
                const row = currentRow.slice();
                const col = currentCol.slice();
                row.push(measure);
                col.push(row);
                cols.push(col);
            }
            return;
        }
        for (let [id, vals] of values[field] || []) {
            let ids = currentIds ? _intersect(currentIds, vals) : vals;
            const row = currentRow.slice();
            const col = currentCol.slice();
            row.push(id);
            col.push(row);
            _fillColumns(cols, row, col, groupBys.slice(1), measures, values, ids);
        }
    }
    /**
     * Fill the rows structure
     *
     * @param {Array} rows Rows to fill
     * @param {Array} currentRow Current value of a row
     * @param {Array<string>} groupBys Name of the fields of colGroupBys
     * @param {Object} values Values of the pivot (see PivotCache.groupBys)
     * @param {Array<number|false} currentIds Ids used to compute the intersection
     *
     * @private
     */
    function _fillRows(rows, currentRow, groupBys, values, currentIds) {
        if (groupBys.length === 0) {
            return;
        }
        const fieldName = groupBys[0];
        for (let [id, vals] of values[fieldName] || []) {
            let ids = currentIds ? _intersect(currentIds, vals) : vals;
            const row = currentRow.slice();
            row.push(id);
            rows.push(row);
            _fillRows(rows, row, groupBys.slice(1), values, ids);
        }
    }
    /**
     * Add a default interval for the date and datetime fields
     *
     * @param {Array<string>} fields List of the fields to sanitize
     * @param {Object} allFields fields_get result
     */
    function _sanitizeFields(fields, allFields) {
        return fields.map((field) => {
            let [ fieldName, group ] = field.split(":");
            const fieldDesc = allFields[fieldName];
            if (["date", "datetime"].includes(fieldDesc.type)) {
                if (!group) {
                    group = "month";
                }
                return `${fieldName}:${group}`;
            }
            return fieldName;
        })
    }

    /**
     * Wait util all the async cells in spreadsheet are computed
     *
     * @param {Object} getters Getters of Spreadsheet model
     */
    async function waitForIdle(getters) {
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if (getters.isIdle()) {
                    clearInterval(interval);
                    resolve();
                }
            }, 20)
        })
    }

    return {
        createPivotCache,
        fetchCache,
        formats,
        formatDate,
        fetchLabel,
        formatGroupBy,
        formatHeader,
        getDataFromTemplate,
        sanitizePivot,
        waitForIdle
    };
});
