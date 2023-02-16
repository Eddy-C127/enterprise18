/** @odoo-module */

import { useService } from "@web/core/utils/hooks";

import { AbstractBehavior } from "@knowledge/components/behaviors/abstract_behavior/abstract_behavior";
import { DrawBehaviorDialog } from "@knowledge/components/behaviors/excalidraw_behavior_dialog/draw_behavior_dialog";
import {
    checkURL,
    decodeDataBehaviorProps,
    encodeDataBehaviorProps,
    excalidrawWebsiteDomainList,
    useMouseResizeListeners,
} from "@knowledge/js/knowledge_utils";

import { onWillStart, useState } from "@odoo/owl";

/**
 * This Behavior loads an Excalidraw iframe to grant users the ability to present schematics and
 * slides.
 */
export class DrawBehavior extends AbstractBehavior {
    static template = "knowledge.DrawBehavior";
    static props = {
        ...AbstractBehavior.props,
        height: { type: String, optional: true },
        source: { type: String },
        width: { type: String, optional: true },
    };

    setup() {
        super.setup();
        this.dialog = useService("dialog");
        this.state = useState({
            height: this.props.height || "400px",
            width: this.props.width || "100%",
        });

        onWillStart(() => this.setupIframe());

        this.onHandleMouseDown = useMouseResizeListeners({
            onMouseDown: this.onMouseDown,
            onMouseMove: this.onMouseMove,
            onMouseUp: this.onMouseUp,
        });
    }

    //--------------------------------------------------------------------------
    // TECHNICAL
    //--------------------------------------------------------------------------

    setupIframe() {
        const behaviorProps = decodeDataBehaviorProps(
            this.props.anchor.dataset.behaviorProps || "{}"
        );
        const url = checkURL(
            behaviorProps.source || this.props.source,
            excalidrawWebsiteDomainList
        );
        if (url) {
            this.state.source = url;
            if (!this.props.readonly) {
                behaviorProps.source = url;
                this.props.anchor.dataset.behaviorProps = encodeDataBehaviorProps(behaviorProps);
            }
        } else {
            this.state.isError = true;
        }
    }

    //--------------------------------------------------------------------------
    // HANDLERS
    //--------------------------------------------------------------------------

    onMouseDown(event) {
        this.state.isResizing = true;
        const bounds = event.target.parentElement.getBoundingClientRect();
        this.refPoint = {
            x: bounds.x + bounds.width / 2,
            y: bounds.y,
        };
    }

    onMouseMove(event) {
        event.preventDefault();
        this.state.width = `${Math.max(2 * Math.abs(this.refPoint.x - event.clientX), 300)}px`;
        this.state.height = `${Math.max(event.clientY - this.refPoint.y, 300)}px`;
    }

    onMouseUp(event) {
        this.state.isResizing = false;
        if (!this.props.readonly) {
            const behaviorProps = decodeDataBehaviorProps(
                this.props.anchor.dataset.behaviorProps || "{}"
            );
            behaviorProps.width = this.state.width;
            behaviorProps.height = this.state.height;
            this.props.anchor.dataset.behaviorProps = encodeDataBehaviorProps(behaviorProps);
        }
    }

    openUpdateSource() {
        if (!this.props.readonly) {
            this.dialog.add(DrawBehaviorDialog, {
                saveLink: (url) => {
                    this.state.isError = false;
                    const behaviorProps = decodeDataBehaviorProps(
                        this.props.anchor.dataset.behaviorProps || "{}"
                    );
                    this.state.source = url;
                    behaviorProps.source = url;
                    this.props.anchor.dataset.behaviorProps =
                        encodeDataBehaviorProps(behaviorProps);
                },
            });
        }
    }
}
