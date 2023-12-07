/* @odoo-module */

import { patch } from "@web/core/utils/patch";
import { AvatarCardResourcePopover } from "@resource_mail/components/avatar_card_resource/avatar_card_resource_popover";


export const patchAvatarCardResourcePopover = {
    loadAdditionalData() {
        const promises = super.loadAdditionalData();
        this.roles = [];
        if (this.record.role_ids?.length) {
            promises.push(
                this.orm
                    .read("planning.role", this.record.role_ids, ["name", "color"])
                    .then((roles) => {
                        this.roles = roles;
                    })
            );
        }
        return promises;
    },
    get fieldNames() {
        return [
            ...super.fieldNames,
            "role_ids",
            "default_role_id",
        ];
    },
    get roleTags() {
        return this.roles.map(({ id, color, name }) => ({
            id,
            colorIndex: color,
            text: name,
            icon: id === this.record.default_role_id?.[0] && this.roles.length > 1 && "fa-star",
            className: "o_planning_avatar_role_tag",
        }));
    },
};

export const unpatchAvatarCardResourcePopover = patch(AvatarCardResourcePopover.prototype, patchAvatarCardResourcePopover);
