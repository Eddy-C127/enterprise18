/** @odoo-module */

import { Domain } from "@web/core/domain";
import { DomainSelector } from "@web/core/domain_selector/domain_selector";
import { DomainSelectorDialog } from "@web/core/domain_selector_dialog/domain_selector_dialog";
import { EditListSortingSection } from "./edit_list_sorting_section/edit_list_sorting_section";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { Component, onWillStart } from "@odoo/owl";
import { getListHighlights } from "../list_highlight_helpers";

import { hooks, components } from "@odoo/o-spreadsheet";

const { useHighlights } = hooks;
const { ValidationMessages, EditableName, CogWheelMenu, Section } = components;

export class ListDetailsSidePanel extends Component {
    static template = "spreadsheet_edition.ListDetailsSidePanel";
    static components = {
        DomainSelector,
        EditableName,
        ValidationMessages,
        CogWheelMenu,
        Section,
        EditListSortingSection,
    };
    static props = {
        onCloseSidePanel: Function,
        listId: String,
    };

    setup() {
        this.getters = this.env.model.getters;
        this.dialog = useService("dialog");
        this.notification = useService("notification");
        const loadData = async (listId) => {
            const dataSource = await this.env.model.getters.getAsyncListDataSource(listId);
            this.modelDisplayName = await dataSource.getModelLabel();
        };
        onWillStart(() => loadData(this.props.listId));
        useHighlights(this);
    }

    get cogWheelMenuItems() {
        return [
            {
                name: "Duplicate",
                icon: "o-spreadsheet-Icon.COPY",
                execute: () => this.duplicateList(),
            },
            {
                name: "Delete",
                icon: "o-spreadsheet-Icon.TRASH",
                execute: () => this.deleteList(),
            },
        ];
    }

    get listDefinition() {
        const listId = this.props.listId;
        const def = this.getters.getListDefinition(listId);
        return {
            model: def.model,
            modelDisplayName: this.modelDisplayName,
            domain: new Domain(def.domain).toString(),
            orderBy: def.orderBy,
        };
    }

    get listFields() {
        const dataSource = this.env.model.getters.getListDataSource(this.props.listId);
        if (dataSource.isMetaDataLoaded()) {
            return dataSource.getFields();
        }
        return {};
    }

    getLastUpdate() {
        const lastUpdate = this.env.model.getters.getListDataSource(this.props.listId).lastUpdate;
        if (lastUpdate) {
            return new Date(lastUpdate).toLocaleTimeString();
        }
        return _t("never");
    }

    getColumnFields() {
        return this.getters
            .getListDefinition(this.props.listId)
            .columns.map((col) => this.listFields[col]);
    }

    onNameChanged(name) {
        this.env.model.dispatch("RENAME_ODOO_LIST", {
            listId: this.props.listId,
            name,
        });
    }

    openDomainEdition() {
        this.dialog.add(DomainSelectorDialog, {
            resModel: this.listDefinition.model,
            domain: this.listDefinition.domain,
            isDebugMode: !!this.env.debug,
            onConfirm: (domain) => {
                const listDefinition = this.getters.getListModelDefinition(this.props.listId);
                this.env.model.dispatch("UPDATE_ODOO_LIST", {
                    listId: this.props.listId,
                    list: {
                        ...listDefinition,
                        searchParams: {
                            ...listDefinition.searchParams,
                            domain: new Domain(domain).toJson(),
                        },
                    },
                });
            },
        });
    }

    /**
     * @param {{name: string, asc: boolean}[]} orderBy
     */
    onUpdateSorting(orderBy) {
        const listDefinition = this.getters.getListModelDefinition(this.props.listId);
        this.env.model.dispatch("UPDATE_ODOO_LIST", {
            listId: this.props.listId,
            list: {
                ...listDefinition,
                searchParams: {
                    ...listDefinition.searchParams,
                    orderBy,
                },
            },
        });
    }

    duplicateList() {
        const newListId = this.env.model.getters.getNextListId();
        const result = this.env.model.dispatch("DUPLICATE_ODOO_LIST", {
            listId: this.props.listId,
            newListId,
        });
        const msg = result.isSuccessful
            ? _t('List duplicated. Use the "Re-insert list" menu item to insert it in a sheet.')
            : _t("List duplication failed");
        const type = result.isSuccessful ? "success" : "danger";
        this.notification.add(msg, { sticky: false, type });
        if (result.isSuccessful) {
            this.env.openSidePanel("LIST_PROPERTIES_PANEL", { listId: newListId });
        }
    }

    deleteList() {
        this.env.askConfirmation(_t("Are you sure you want to delete this list?"), () => {
            this.env.model.dispatch("REMOVE_ODOO_LIST", { listId: this.props.listId });
            this.props.onCloseSidePanel();
        });
    }

    get unusedListWarning() {
        return _t("This list is not used");
    }

    get highlights() {
        return getListHighlights(this.env.model.getters, this.props.listId);
    }
}
