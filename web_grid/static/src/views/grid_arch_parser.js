/** @odoo-module */

import { XMLParser } from "@web/core/utils/xml";
import { Field } from "@web/views/fields/field";
import { archParseBoolean, getActiveActions, processButton } from "@web/views/utils";

export class GridArchParser extends XMLParser {
    parse(arch, models, modelName) {
        const xmlDoc = this.parseXML(arch);
        const archInfo = {
            activeActions: getActiveActions(xmlDoc),
            hideLineTotal: false,
            hideColumnTotal: false,
            hasBarChartTotal: false,
            createInline: false,
            displayEmpty: false,
            buttons: [],
            activeRangeName: "",
            ranges: {},
            sectionField: null,
            rowFields: [],
            columnFieldName: "",
            measureField: { name: "__count" },
            readonlyField: null,
            widgetPerFieldName: {},
            editable: false,
            formViewId: false,
        };
        let buttonId = 0;

        this.visitXML(arch, (node) => {
            if (node.tagName === "grid") {
                if (node.hasAttribute("hide_line_total")) {
                    archInfo.hideLineTotal = archParseBoolean(node.getAttribute("hide_line_total"));
                }
                if (node.hasAttribute("hide_column_total")) {
                    archInfo.hideColumnTotal = archParseBoolean(
                        node.getAttribute("hide_column_total")
                    );
                }
                if (node.hasAttribute("barchart_total")) {
                    archInfo.hasBarChartTotal = archParseBoolean(
                        node.getAttribute("barchart_total")
                    );
                }
                if (node.hasAttribute("create_inline")) {
                    archInfo.createInline = archParseBoolean(node.getAttribute("create_inline"));
                }
                if (node.hasAttribute("display_empty")) {
                    archInfo.displayEmpty = archParseBoolean(node.getAttribute("display_empty"));
                }
                if (node.hasAttribute("action") && node.hasAttribute("type")) {
                    archInfo.openAction = {
                        name: node.getAttribute("action"),
                        type: node.getAttribute("type"),
                    };
                }
                if (node.hasAttribute("editable")) {
                    archInfo.editable = archParseBoolean(node.getAttribute("editable"));
                }
                if (node.hasAttribute("form_view_id")) {
                    archInfo.formViewId = parseInt(node.getAttribute("form_view_id"), 10);
                }
            } else if (node.tagName === "field") {
                const fieldInfo = Field.parseFieldNode(node, models, modelName, "grid");
                const fieldName = node.getAttribute("name"); // exists (rng validation)
                const type = node.getAttribute("type") || "row";
                switch (type) {
                    case "row":
                        if (fieldInfo.widget) {
                            archInfo.widgetPerFieldName[fieldName] = fieldInfo.widget;
                        }
                        if (
                            node.hasAttribute("section") &&
                            archParseBoolean(node.getAttribute("section")) &&
                            !archInfo.sectionField
                        ) {
                            archInfo.sectionField = {
                                name: fieldName,
                                invisible: fieldInfo.alwaysInvisible,
                            };
                        } else {
                            archInfo.rowFields.push({
                                name: fieldName,
                                invisible: fieldInfo.alwaysInvisible,
                            });
                        }
                        break;
                    case "col":
                        archInfo.columnFieldName = fieldName;
                        const { ranges, activeRangeName } = this._extractRanges(node);
                        archInfo.ranges = ranges;
                        archInfo.activeRangeName = activeRangeName;
                        break;
                    case "measure":
                        let group_operator = models[modelName][fieldName].group_operator;
                        if (node.hasAttribute("operator")) {
                            group_operator = node.getAttribute("operator");
                        }
                        if (fieldInfo.widget) {
                            archInfo.widgetPerFieldName[fieldName] = fieldInfo.widget;
                        }
                        archInfo.measureField = {
                            name: fieldName,
                            group_operator: group_operator,
                            string: fieldInfo.string,
                        };
                        break;
                    case "readonly":
                        let groupOperator = models[modelName][fieldName].group_operator;
                        if (node.hasAttribute("operator")) {
                            groupOperator = node.getAttribute("operator");
                        }
                        archInfo.readonlyField = {
                            name: fieldName,
                            group_operator: groupOperator,
                            string: fieldInfo.string,
                        };
                        break;
                }
            } else if (node.tagName === "button") {
                archInfo.buttons.push({
                    ...processButton(node),
                    type: "button",
                    id: buttonId++,
                });
            }
        });
        archInfo.editable =
            archInfo.editable &&
            archInfo.measureField &&
            archInfo.measureField.group_operator === "sum";
        return archInfo;
    }

    /**
     * Extract the range to display on the view, and filter
     * them according they should be visible or not (attribute 'invisible')
     *
     * @private
     * @param {Element} colNode - the node of 'col' in grid view arch definition
     * @returns {
     *      Object<{
     *          ranges: {
     *              name: {name: string, label: string, span: string, step: string, hotkey?: string}
     *          },
     *          activeRangeName: string,
     *      }>
     *  } list of ranges to apply in the grid view.
     */
    _extractRanges(colNode) {
        const ranges = {};
        let activeRangeName;
        let firstRangeName = "";
        for (const rangeNode of colNode.children) {
            const rangeName = rangeNode.getAttribute("name");
            if (!firstRangeName.length) {
                firstRangeName = rangeName;
            }
            ranges[rangeName] = {
                name: rangeName,
                description: rangeNode.getAttribute("string"),
                span: rangeNode.getAttribute("span"),
                step: rangeNode.getAttribute("step"),
                hotkey: rangeNode.getAttribute("hotkey"),
                default: archParseBoolean(rangeNode.getAttribute("default")),
            };
            if (ranges[rangeName].default) {
                activeRangeName = rangeName;
            }
        }
        return { ranges: ranges, activeRangeName: activeRangeName || firstRangeName };
    }
}
