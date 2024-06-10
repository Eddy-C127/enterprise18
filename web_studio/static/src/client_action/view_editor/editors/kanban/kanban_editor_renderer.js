import { kanbanView } from "@web/views/kanban/kanban_view";
import { KanbanEditorRecord } from "@web_studio/client_action/view_editor/editors/kanban/kanban_editor_record";
import { useRef, useEffect } from "@odoo/owl";

export class KanbanEditorRenderer extends kanbanView.Renderer {
    static template = "web_studio.KanbanEditorRenderer";
    static components = {
        ...kanbanView.Renderer.components,
        KanbanRecord: KanbanEditorRecord,
    };

    setup() {
        super.setup();
        const rootRef = useRef("root");
        useEffect(
            (el) => {
                if (!el) {
                    return;
                }
                el.classList.add("o_web_studio_kanban_view_editor");
            },
            () => [rootRef.el]
        );
    }
}
