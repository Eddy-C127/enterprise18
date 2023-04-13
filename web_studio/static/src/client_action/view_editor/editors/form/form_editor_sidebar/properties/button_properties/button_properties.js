/** @odoo-module */

import { Component, onWillStart, onWillUpdateProps, useState } from "@odoo/owl";
import { CheckBox } from "@web/core/checkbox/checkbox";
import { DomainSelectorDialog } from "@web/core/domain_selector_dialog/domain_selector_dialog";
import { Many2XAutocomplete } from "@web/views/fields/relational_utils";
import { SelectMenu } from "@web/core/select_menu/select_menu";
import { Property } from "@web_studio/client_action/view_editor/property/property";
import { useService } from "@web/core/utils/hooks";
import { LimitGroupVisibility } from "@web_studio/client_action/view_editor/interactive_editor/properties/limit_group_visibility/limit_group_visibility";
import { RainbowEffect } from "./rainbow_effect";
import { SidebarPropertiesToolbox } from "@web_studio/client_action/view_editor/interactive_editor/properties/sidebar_properties_toolbox/sidebar_properties_toolbox";
import { useEditNodeAttributes } from "@web_studio/client_action/view_editor/view_editor_model";

export class ButtonProperties extends Component {
    static template = "web_studio.ViewEditor.InteractiveEditorProperties.Button";
    static props = {
        node: { type: Object },
    };
    static components = {
        CheckBox,
        LimitGroupVisibility,
        Many2XAutocomplete,
        RainbowEffect,
        SelectMenu,
        Property,
        SidebarPropertiesToolbox,
    };

    setup() {
        this.dialog = useService("dialog");
        this.orm = useService("orm");
        this.rpc = useService("rpc");
        this.state = useState({});
        this.editNodeAttributes = useEditNodeAttributes();

        onWillStart(() => {
            if (this.props.node.attrs.studio_approval) {
                this.updateApprovalSpec();
            }
        });

        onWillUpdateProps((nextProps) => {
            if (nextProps.node.attrs.studio_approval) {
                this.updateApprovalSpec(this.getApprovalParams(nextProps.node));
            } else {
                delete this.state.approvalSpec;
            }
        });
    }

    onChangeAttribute(value, name) {
        return this.editNodeAttributes({ [name]: value });
    }

    get showRainbowMan() {
        const attrs = this.props.node.attrs;
        return attrs.class !== "oe_stat_button" && attrs.type === "object";
    }

    async createApprovalRule() {
        // TODO FIXME snackbar save status not handled
        const params = this.getApprovalParams();
        await this.orm.call("studio.approval.rule", "create_rule", params);
        this.updateApprovalSpec();
    }

    getApprovalParams(node = this.props.node) {
        let method,
            action = false;
        if (node.attrs.type === "object") {
            method = node.attrs.name;
        } else {
            action = node.attrs.name;
        }
        return [this.env.viewEditorModel.resModel, method, action];
    }

    async getApprovalSpec(approvalParams) {
        return await this.orm.call("studio.approval.rule", "get_approval_spec", approvalParams);
    }

    async onApprovalArchive(id) {
        await this.orm.write("studio.approval.rule", [id], {
            active: false,
        });
        this.updateApprovalSpec();
    }

    async onApprovalEdit(name, id, value) {
        const isMethod = this.props.node.attrs.type === "object";
        await this.rpc("/web_studio/edit_approval", {
            model: this.env.viewEditorModel.resModel,
            method: isMethod ? this.props.node.attrs.name : false,
            action: isMethod ? false : this.props.node.attrs.name,
            operations: [[name, id, value]],
        });
        this.updateApprovalSpec();
    }

    onApprovalSelectDomain(id) {
        const domain = this.state.approvalSpec.rules.find((r) => r.id === id).domain;
        this.dialog.add(DomainSelectorDialog, {
            resModel: this.env.viewEditorModel.resModel,
            domain: JSON.stringify(domain || []),
            isDebugMode: !!this.env.debug,
            onConfirm: async (domain) => {
                await this.orm.write("studio.approval.rule", [id], {
                    domain,
                });
                this.updateApprovalSpec();
            },
        });
    }

    async onApprovalSelectRule(ruleProperty, selection, id) {
        if (selection && selection.length) {
            await this.orm.write(
                "studio.approval.rule",
                [id],
                Object.fromEntries([[ruleProperty, selection[0].id]])
            );
            this.updateApprovalSpec();
        }
    }

    async updateApprovalSpec(params = this.getApprovalParams()) {
        this.state.approvalSpec = await this.getApprovalSpec(params);
    }
}
