/** @odoo-module **/

import { ListRenderer } from "@web/views/list/list_renderer";

import { useService } from "@web/core/utils/hooks";
import { DocumentsInspector } from "../inspector/documents_inspector";
import { FileUploadProgressContainer } from "@web/core/file_upload/file_upload_progress_container";
import { FileUploadProgressDataRow } from "@web/core/file_upload/file_upload_progress_record";
import { DocumentsDropZone } from "../helper/documents_drop_zone";
import { DocumentsActionHelper } from "../helper/documents_action_helper";
import { DocumentsFileViewer } from "../helper/documents_file_viewer";
import { DocumentsListRendererCheckBox } from "./documents_list_renderer_checkbox";

const { useRef } = owl;

export class DocumentsListRenderer extends ListRenderer {
    setup() {
        super.setup();
        this.root = useRef("root");
        const { uploads } = useService("file_upload");
        this.documentUploads = uploads;
    }

    /**
     * Called when a keydown event is triggered.
     */
    onGlobalKeydown(ev) {
        if (ev.key !== "Enter" && ev.key !== " ") {
            return;
        }
        const row = ev.target.closest(".o_data_row");
        const record = row && this.props.list.records.find((rec) => rec.id === row.dataset.id);
        if (!record) {
            return;
        }
        const options = {};
        if (ev.key === " ") {
            options.isKeepSelection = true;
        }
        ev.stopPropagation();
        ev.preventDefault();
        record.onRecordClick(ev, options);
    }

    /**
     * There's a custom behavior on cell clicked as we (un)select the row (see record.onRecordClick)
     */
    onCellClicked() {}

    /**
     * Called when a click event is triggered.
     */
    onGlobalClick(ev) {
        // We have to check that we are indeed clicking in the list view as on mobile,
        // the inspector renders above the renderer but it still triggers this event.
        if (ev.target.closest(".o_data_row") || !ev.target.closest(".o_list_renderer")) {
            return;
        }
        this.props.list.selection.forEach((el) => el.toggleSelection(false));
    }

    get hasSelectors() {
        return this.props.allowSelectors;
    }

    getDocumentsInspectorProps() {
        return {
            selection: this.props.list.selection,
            count: this.props.list.model.useSampleModel ? 0 : this.props.list.count,
            fileSize: this.props.list.fileSize,
            archInfo: this.props.archInfo,
            withFilePreview: !this.env.documentsView.previewStore.documentList,
        };
    }
}

DocumentsListRenderer.template = "documents.DocumentsListRenderer";
DocumentsListRenderer.recordRowTemplate = "documents.DocumentsListRenderer.RecordRow";

DocumentsListRenderer.components = Object.assign({}, ListRenderer.components, {
    DocumentsInspector,
    DocumentsListRendererCheckBox,
    FileUploadProgressContainer,
    FileUploadProgressDataRow,
    DocumentsDropZone,
    DocumentsActionHelper,
    DocumentsFileViewer,
});
