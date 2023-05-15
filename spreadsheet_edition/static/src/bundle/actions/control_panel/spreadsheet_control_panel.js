/** @odoo-module **/

import { ControlPanel } from "@web/search/control_panel/control_panel";
import { useService } from "@web/core/utils/hooks";
import { SpreadsheetName } from "./spreadsheet_name";
import { SpreadsheetShareButton } from "@spreadsheet/components/share_button/share_button";
import { session } from "@web/session";

import { Component, onWillUnmount, useState } from "@odoo/owl";

/**
 * @typedef {import("@spreadsheet_edition/bundle/actions/spreadsheet_component").User} User
 */

export class SpreadsheetControlPanel extends Component {
    setup() {
        this.controlPanelDisplay = {};
        this.actionService = useService("action");
        this.breadcrumbs = useState(this.env.config.breadcrumbs);
        this.collaborative = useState({
            isSynced: true,
            connectedUsers: [{ name: session.username, id: session.id }],
        });
        const model = this.props.model;
        if (this.props.displayCollaborativeInfo && model) {
            model.on("update", this, this.syncState.bind(this));
            onWillUnmount(() => model.off("update", this));
        }
    }

    syncState() {
        this.collaborative.isSynced = this.props.model.getters.isFullySynchronized();
        this.collaborative.connectedUsers = this.getConnectedUsers();
    }

    /**
     * Called when an element of the breadcrumbs is clicked.
     *
     * @param {string} jsId
     */
    onBreadcrumbClicked(jsId) {
        this.actionService.restore(jsId);
    }

    get tooltipInfo() {
        return JSON.stringify({
            users: this.collaborative.connectedUsers.map((/**@type User*/ user) => {
                return {
                    name: user.name,
                    avatar: `/web/image?model=res.users&field=avatar_128&id=${user.id}`,
                };
            }),
        });
    }

    /**
     * Return the number of connected users. If one user has more than
     * one open tab, it's only counted once.
     * @return {Array<User>}
     */
    getConnectedUsers() {
        const connectedUsers = [];
        for (const client of this.props.model.getters.getConnectedClients()) {
            if (!connectedUsers.some((user) => user.id === client.userId)) {
                connectedUsers.push({
                    id: client.userId,
                    name: client.name,
                });
            }
        }
        return connectedUsers;
    }
}

SpreadsheetControlPanel.template = "spreadsheet_edition.SpreadsheetControlPanel";
SpreadsheetControlPanel.components = {
    ControlPanel,
    SpreadsheetName,
    SpreadsheetShareButton,
};
SpreadsheetControlPanel.props = {
    spreadsheetName: String,
    model: {
        type: Object,
        optional: true,
    },
    displayCollaborativeInfo: {
        type: Boolean,
        optional: true,
    },
    isReadonly: {
        type: Boolean,
        optional: true,
    },
    onSpreadsheetNameChanged: {
        type: Function,
        optional: true,
    },
};
SpreadsheetControlPanel.defaultProps = {
    displayCollaborativeInfo: true,
};
