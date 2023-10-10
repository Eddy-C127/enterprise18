/* @odoo-module */

import { Avatar } from "@mail/views/web/fields/avatar/avatar";
import { AvatarCardResourcePopover } from "@resource_mail/components/avatar_card_resource/avatar_card_resource_popover";
import { useEffect, useRef } from "@odoo/owl";
import { usePopover } from "@web/core/popover/popover_hook";


export class PlanningEmployeeAvatar extends Avatar {
    static template = "planning.PlanningEmployeeAvatar";

    static props = {
        ...Avatar.props,
        isResourceMaterial: { type: Boolean },
        showPopover: { type: Boolean },
        resourceColor: { type: Number },
    };

    setup() {
        const displayNameRef = useRef("displayName");
        useEffect(
            (displayNameEl) => {
                // Mute the last content between parenthesis in Gantt title column
                const text = displayNameEl.textContent;
                const jobTitleRegexp = /^(.*)(\(.*\))$/;
                const jobTitleMatch = text.match(jobTitleRegexp);
                if (jobTitleMatch) {
                    const textMuted = document.createElement("span");
                    textMuted.className = "text-muted text-truncate";
                    textMuted.replaceChildren(jobTitleMatch[2]);
                    displayNameEl.replaceChildren(jobTitleMatch[1], textMuted);
                }
            },
            () => [displayNameRef.el]
        );

        this.avatarCard = usePopover(AvatarCardResourcePopover);
    }

    openCard(ev) {
        if (this.env.isSmall || !this.props.showPopover) {
            return;
        }
        const target = ev.currentTarget;
        if (!this.avatarCard.isOpen) {
            this.avatarCard.open(target, {
                id: this.props.resId,
            });
        }
    }
}
