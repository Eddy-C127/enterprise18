import { hooks } from "@odoo/o-spreadsheet";
import { Component, useRef } from "@odoo/owl";
import { PivotDimension } from "./pivot_dimension/pivot_dimension";
import { AddDimensionButton } from "./add_dimension_button/add_dimension_button";

const { useDragAndDropListItems } = hooks;

export class PivotDimensions extends Component {
    static template = "spreadsheet_edition.PivotDimensions";
    static components = { AddDimensionButton, PivotDimension };
    static props = {
        definition: Object,
        onDimensionsUpdated: Function,
        unusedGroupableFields: Array,
        unusedMeasureFields: Array,
    };

    setup() {
        this.dimensionsRef = useRef("pivot-dimensions");
        this.dragAndDrop = useDragAndDropListItems();
    }

    updateDimensions(dimensions) {
        const definition = this.props.definition;
        const { columns, rows, measures } = definition;
        this.props.onDimensionsUpdated({
            columns: columns.map((col) => col.name),
            rows: rows.map((row) => row.name),
            measures: measures.map((m) => m.name),
            ...dimensions,
        });
    }

    startDragAndDrop(dimension, event) {
        if (event.button !== 0) {
            return;
        }

        const rects = this.getDimensionElementsRects();
        const definition = this.props.definition;
        const { columns, rows } = definition;
        const draggableIds = [
            "__column_title__",
            ...columns.map((col) => col.name),
            "__rows_title__",
            ...rows.map((row) => row.name),
        ];
        const draggableItems = draggableIds.map((id, index) => ({
            id,
            size: rects[index].height,
            position: rects[index].y,
        }));
        this.dragAndDrop.start("vertical", {
            draggedItemId: dimension.name,
            initialMousePosition: event.clientY,
            items: draggableItems,
            containerEl: this.dimensionsRef.el,
            onDragEnd: (dimensionName, finalIndex) => {
                const originalIndex = draggableIds.findIndex((id) => id === dimensionName);
                const draggedItems = [...draggableIds];
                draggedItems.splice(originalIndex, 1);
                draggedItems.splice(finalIndex, 0, dimensionName);
                draggedItems.splice(draggedItems.indexOf("__column_title__"), 1);
                const columns = draggedItems.slice(0, draggedItems.indexOf("__rows_title__"));
                const rows = draggedItems.slice(draggedItems.indexOf("__rows_title__") + 1);
                this.updateDimensions({ columns, rows });
            },
        });
    }

    startDragAndDropMeasures(measure, event) {
        if (event.button !== 0) {
            return;
        }

        const rects = this.getDimensionElementsRects();
        const definition = this.props.definition;
        const { measures } = definition;
        const draggableIds = measures.map((m) => m.name);
        const offset = 5; // column title, columns, row title, rows, measure title
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
                const draggedItems = [...draggableIds];
                draggedItems.splice(originalIndex, 1);
                draggedItems.splice(finalIndex, 0, measureName);
                this.updateDimensions({ measures: draggedItems });
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
        this.updateDimensions({
            columns: columns.filter((col) => col.name !== dimension.name).map((col) => col.name),
            rows: rows.filter((row) => row.name !== dimension.name).map((row) => row.name),
        });
    }

    removeMeasureDimension(measure) {
        const { measures } = this.props.definition;
        this.updateDimensions({
            measures: measures.filter((m) => m.name !== measure.name).map((m) => m.name),
        });
    }

    addColumnDimension(fieldName) {
        const { columns } = this.props.definition;
        this.updateDimensions({
            columns: columns.map((col) => col.name).concat([fieldName]),
        });
    }

    addRowDimension(fieldName) {
        const { rows } = this.props.definition;
        this.updateDimensions({
            rows: rows.map((col) => col.name).concat([fieldName]),
        });
    }

    addMeasureDimension(fieldName) {
        const { measures } = this.props.definition;
        this.updateDimensions({
            measures: measures.map((m) => m.name).concat([fieldName]),
        });
    }
}
