import { hooks } from "@odoo/o-spreadsheet";
import { Component, useRef } from "@odoo/owl";
import { PivotDimension } from "./pivot_dimension/pivot_dimension";
import { PivotDimensionOrder } from "./pivot_dimension_order/pivot_dimension_order";
import { AddDimensionButton } from "./add_dimension_button/add_dimension_button";
import { AGGREGATORS, isDateField, parseDimension } from "@spreadsheet/pivot/pivot_helpers";
import { PivotDimensionGranularity } from "./pivot_dimension_granularity/pivot_dimension_granularity";

const { useDragAndDropListItems } = hooks;

export class PivotDimensions extends Component {
    static template = "spreadsheet_edition.PivotDimensions";
    static components = {
        AddDimensionButton,
        PivotDimension,
        PivotDimensionOrder,
        PivotDimensionGranularity,
    };
    static props = {
        definition: Object,
        onDimensionsUpdated: Function,
        unusedGroupableFields: Array,
        unusedMeasureFields: Array,
        unusedDateTimeGranularities: Object,
    };

    setup() {
        this.dimensionsRef = useRef("pivot-dimensions");
        this.dragAndDrop = useDragAndDropListItems();
        this.AGGREGATORS = AGGREGATORS;
        //@ts-ignore Used in the template
        this.isDateField = isDateField;
    }

    startDragAndDrop(dimension, event) {
        if (event.button !== 0 || event.target.tagName === "SELECT") {
            return;
        }

        const rects = this.getDimensionElementsRects();
        const definition = this.props.definition;
        const { columns, rows } = definition;
        const draggableIds = [
            ...columns.map((col) => col.nameWithGranularity),
            "__rows_title__",
            ...rows.map((row) => row.nameWithGranularity),
        ];
        const offset = 1; // column title
        const draggableItems = draggableIds.map((id, index) => ({
            id,
            size: rects[index + offset].height,
            position: rects[index + offset].y,
        }));
        this.dragAndDrop.start("vertical", {
            draggedItemId: dimension.nameWithGranularity,
            initialMousePosition: event.clientY,
            items: draggableItems,
            containerEl: this.dimensionsRef.el,
            onDragEnd: (dimensionName, finalIndex) => {
                const originalIndex = draggableIds.findIndex((id) => id === dimensionName);
                if (originalIndex === finalIndex) {
                    return;
                }
                const draggedItems = [...draggableIds];
                draggedItems.splice(originalIndex, 1);
                draggedItems.splice(finalIndex, 0, dimensionName);
                const columns = draggedItems.slice(0, draggedItems.indexOf("__rows_title__"));
                const rows = draggedItems.slice(draggedItems.indexOf("__rows_title__") + 1);
                this.props.onDimensionsUpdated({
                    columns: columns.map(parseDimension),
                    rows: rows.map(parseDimension),
                });
            },
        });
    }

    startDragAndDropMeasures(measure, event) {
        if (event.button !== 0 || event.target.tagName === "SELECT") {
            return;
        }

        const rects = this.getDimensionElementsRects();
        const definition = this.props.definition;
        const { measures, columns, rows } = definition;
        const draggableIds = measures.map((m) => m.name);
        const offset = 3 + columns.length + rows.length; // column title, row title, measure title
        const draggableItems = draggableIds.map((id, index) => ({
            id,
            size: rects[index + offset].height,
            position: rects[index + offset].y,
        }));
        this.dragAndDrop.start("vertical", {
            draggedItemId: measure.name,
            initialMousePosition: event.clientY,
            items: draggableItems,
            containerEl: this.dimensionsRef.el,
            onDragEnd: (measureName, finalIndex) => {
                const originalIndex = draggableIds.findIndex((id) => id === measureName);
                if (originalIndex === finalIndex) {
                    return;
                }
                const draggedItems = [...draggableIds];
                draggedItems.splice(originalIndex, 1);
                draggedItems.splice(finalIndex, 0, measureName);
                this.props.onDimensionsUpdated({
                    measures: draggedItems.map((m) =>
                        measures.find((measure) => measure.name === m)
                    ),
                });
            },
        });
    }

    getDimensionElementsRects() {
        return Array.from(this.dimensionsRef.el.children).map((el) => {
            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return {
                x: rect.x,
                y: rect.y,
                width:
                    rect.width + parseInt(style.marginLeft || 0) + parseInt(style.marginRight || 0),
                height:
                    rect.height +
                    parseInt(style.marginTop || 0) +
                    parseInt(style.marginBottom || 0),
            };
        });
    }

    removeDimension(dimension) {
        const { columns, rows } = this.props.definition;
        this.props.onDimensionsUpdated({
            columns: columns.filter(
                (col) => col.nameWithGranularity !== dimension.nameWithGranularity
            ),
            rows: rows.filter((row) => row.nameWithGranularity !== dimension.nameWithGranularity),
        });
    }

    removeMeasureDimension(measure) {
        const { measures } = this.props.definition;
        this.props.onDimensionsUpdated({
            measures: measures.filter((m) => m.name !== measure.name),
        });
    }

    addColumnDimension(fieldName) {
        const { columns } = this.props.definition;
        this.props.onDimensionsUpdated({
            columns: columns.map((col) => col).concat([{ name: fieldName }]),
        });
    }

    addRowDimension(fieldName) {
        const { rows } = this.props.definition;
        this.props.onDimensionsUpdated({
            rows: rows.map((col) => col).concat([{ name: fieldName }]),
        });
    }

    addMeasureDimension(fieldName) {
        const { measures } = this.props.definition;
        this.props.onDimensionsUpdated({
            measures: measures.concat([{ name: fieldName }]),
        });
    }

    updateAggregator(updatedMeasure, aggregator) {
        const { measures } = this.props.definition;
        this.props.onDimensionsUpdated({
            measures: measures.map((measure) => {
                if (measure === updatedMeasure) {
                    return { ...measure, aggregator };
                }
                return measure;
            }),
        });
    }

    updateOrder(updateDimension, order) {
        const { rows, columns } = this.props.definition;
        this.props.onDimensionsUpdated({
            rows: rows.map((row) => {
                if (row.nameWithGranularity === updateDimension.nameWithGranularity) {
                    return { ...row, order: order || undefined };
                }
                return row;
            }),
            columns: columns.map((col) => {
                if (col.nameWithGranularity === updateDimension.nameWithGranularity) {
                    return { ...col, order: order || undefined };
                }
                return col;
            }),
        });
    }

    updateGranularity(dimension, granularity) {
        const { rows, columns } = this.props.definition;
        this.props.onDimensionsUpdated({
            rows: rows.map((row) => {
                if (row.nameWithGranularity === dimension.nameWithGranularity) {
                    return { ...row, granularity };
                }
                return row;
            }),
            columns: columns.map((col) => {
                if (col.nameWithGranularity === dimension.nameWithGranularity) {
                    return { ...col, granularity };
                }
                return col;
            }),
        });
    }
}
