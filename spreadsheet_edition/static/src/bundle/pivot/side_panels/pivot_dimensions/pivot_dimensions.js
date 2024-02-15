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
    };

    setup() {
        this.dimensionsRef = useRef("pivot-dimensions");
        this.dragAndDrop = useDragAndDropListItems();
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
                this.props.onDimensionsUpdated({ columns, rows });
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
            columns: columns.filter((col) => col.name !== dimension.name).map((col) => col.name),
            rows: rows.filter((row) => row.name !== dimension.name).map((row) => row.name),
        });
    }

    addColumnDimension(fieldName) {
        const { columns, rows } = this.props.definition;
        this.props.onDimensionsUpdated({
            columns: columns.map((col) => col.name).concat([fieldName]),
            rows: rows.map((row) => row.name),
        });
    }

    addRowDimension(fieldName) {
        const { columns, rows } = this.props.definition;
        this.props.onDimensionsUpdated({
            columns: columns.map((col) => col.name),
            rows: rows.map((col) => col.name).concat([fieldName]),
        });
    }
}
