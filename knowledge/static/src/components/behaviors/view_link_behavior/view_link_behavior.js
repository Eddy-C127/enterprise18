/** @odoo-module */

import { AbstractBehavior } from "@knowledge/components/behaviors/abstract_behavior/abstract_behavior";
import {
    ViewLinkBehaviorDialog,
    VIEW_LINK_BEHAVIOR_STYLES,
} from "@knowledge/components/behaviors/view_link_behavior_dialog/view_link_behavior_dialog";
import { ViewLinkBehaviorPopover } from "@knowledge/components/behaviors/view_link_behavior/view_link_behavior_popover";
import {
    copyOids,
    decodeDataBehaviorProps,
    encodeDataBehaviorProps,
    useRefWithSingleCollaborativeChild,
} from "@knowledge/js/knowledge_utils";
import { onMounted, status, useExternalListener } from "@odoo/owl";
import { setCursorEnd } from "@web_editor/js/editor/odoo-editor/src/utils/utils";
import { makeContext } from "@web/core/context";
import { _t } from "@web/core/l10n/translation";
import { usePopover } from "@web/core/popover/popover_hook";
import { user } from "@web/core/user";
import { useService } from "@web/core/utils/hooks";
import { renderToElement } from "@web/core/utils/render";


/**
 * Clickable "link" to access a view from an article with custom facets (only
 * usable in Odoo)
 */
export class ViewLinkBehavior extends AbstractBehavior {
    static props = {
        ...AbstractBehavior.props,
        action_xml_id: { type: String, optional: true },
        act_window: { type: Object, optional: true },
        context: { type: Object },
        name: { type: String },
        view_type: { type: String },
        style: {
            type: String,
            optional: true,
            validate: (style) => Object.keys(VIEW_LINK_BEHAVIOR_STYLES).includes(style),
        },
    };
    static defaultProps = {
        style: "link",
    };
    static template = "knowledge.ViewLinkBehavior";
    static inline = true;

    setup () {
        super.setup();
        this.actionService = useService('action');
        this.dialog = useService("dialog");
        this.notification = useService("notification");
        this.popover = usePopover(ViewLinkBehaviorPopover, { popoverClass: "o_edit_menu_popover" });
        this.displayName = this.props.name;
        this.style = this.props.style;
        useExternalListener(
            this.props.anchor,
            "click",
            async () => {
                const isInternalUser = await user.hasGroup("base.group_user");
                if (status(this) === "destroyed") {
                    return;
                }
                if (!isInternalUser) {
                    return this.notification.add(_t("Only Internal Users can access this view."), {
                        type: "warning",
                    });
                }
                this.props.readonly ? this.openViewLink() : this.openViewLinkPopOver();
            }
        );
        this.linkNameRef = useRefWithSingleCollaborativeChild("linkNameRef", (element) => {
            const linkName = this.linkNameSpanTextContent;
            if (element && linkName.length) {
                let currentStyle = this.style;
                for (const [style, properties] of Object.entries(VIEW_LINK_BEHAVIOR_STYLES)) {
                    if (element.getAttribute("class").includes(properties.class)) {
                        currentStyle = style;
                        break;
                    }
                }
                this.setLinkName(linkName, currentStyle);
            } else {
                this.renderLinkName();
                this.editor.historyStep();
            }
        });
        if (this.props.readonly) {
            onMounted(() => {
                this.renderLinkName();
            });
        }
    }

    //--------------------------------------------------------------------------
    // GETTERS/SETTERS
    //--------------------------------------------------------------------------

    /**
     * @returns {String} linkName as it is written in the editor.
     */
    get linkNameSpanTextContent() {
        return this.linkNameRef.el.querySelector(".o_knowledge_view_link_name")?.textContent || "";
    }

    //--------------------------------------------------------------------------
    // TECHNICAL
    //--------------------------------------------------------------------------

    /**
     * @override
     * Render the linkName just before the Behavior is inserted in the editor.
     * @see AbstractBehavior for the full explanation.
     */
    extraRender() {
        super.extraRender();
        this.renderLinkName();
    }

    /**
     * @override
     * The linkNameRef nodes have to be shared in collaboration but are not
     * directly an html prop of this Behavior, hence this override to set their
     * oids. @see AbstractBehavior for the full explanation.
     */
    synchronizeOids(blueprint) {
        super.synchronizeOids(blueprint);
        const currentLinkNameEl = this.props.anchor.querySelector(
            '.o_knowledge_view_link_name_container[data-oe-protected="false"]'
        );
        const blueprintLinkNameEl = blueprint.querySelector(
            '.o_knowledge_view_link_name_container[data-oe-protected="false"]'
        );
        if (!blueprintLinkNameEl) {
            return;
        }
        copyOids(blueprintLinkNameEl, currentLinkNameEl);
    }

    //--------------------------------------------------------------------------
    // BUSINESS
    //--------------------------------------------------------------------------

    renderLinkName() {
        const linkNameEl = renderToElement("knowledge.ViewLinkBehaviorName", {
            linkName: this.displayName,
            style: VIEW_LINK_BEHAVIOR_STYLES[this.style].class,
        });
        this.linkNameRef.el.replaceChildren(linkNameEl);
    }

    setLinkName(newName, style) {
        if (newName === this.displayName && style === this.style) {
            return;
        }
        this.style = style;
        this.displayName = newName;
        const props = decodeDataBehaviorProps(this.props.anchor.dataset.behaviorProps);
        props.name = this.displayName;
        props.style = this.style;
        this.props.anchor.dataset.behaviorProps = encodeDataBehaviorProps(props);
        this.renderLinkName();
        this.editor.historyStep();
    }

    //--------------------------------------------------------------------------
    // HANDLERS
    //--------------------------------------------------------------------------

    onCopyLinkClick() {
        const range = document.createRange();
        range.selectNode(this.props.anchor);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        const copySucceeded = document.execCommand("copy");
        selection.removeAllRanges();
        if (copySucceeded) {
            this.notification.add(_t("Link copied to clipboard."), {
                type: "success",
            });
        }
        this.popover.close();
    }

    onEditLinkClick() {
        this.dialog.add(ViewLinkBehaviorDialog, {
            name: this.displayName,
            style: this.style,
            onSave: this.setLinkName.bind(this),
        });
        this.popover.close();
    }

    onRemoveLinkClick() {
        const nameNode = this.editor.document.createTextNode(this.displayName);
        this.props.anchor.replaceWith(nameNode);
        setCursorEnd(nameNode);
        this.editor.historyStep();
    }

    async openViewLink() {
        const action = await this.actionService.loadAction(
            this.props.act_window || this.props.action_xml_id,
            makeContext([this.props.context])
        );
        if (action.type !== "ir.actions.act_window") {
            throw new Error('Can not open the view: The action is not an "ir.actions.act_window"');
        }
        action.globalState = {
            searchModel: this.props.context.knowledge_search_model_state
        };
        const props = {};
        if (action.context.orderBy) {
            try {
                props.orderBy = JSON.parse(action.context.orderBy);
            } catch {};
        }
        this.actionService.doAction(action, {
            viewType: this.props.view_type,
            props
        });
    }

    openViewLinkPopOver() {
        this.popover.open(this.props.anchor, {
            name: this.displayName,
            openViewLink: this.openViewLink.bind(this),
            onCopyLinkClick: this.onCopyLinkClick.bind(this),
            onEditLinkClick: this.onEditLinkClick.bind(this),
            onRemoveLinkClick: this.onRemoveLinkClick.bind(this),
        });
    }
}
