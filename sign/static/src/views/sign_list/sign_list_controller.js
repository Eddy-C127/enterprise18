/** @odoo-module **/

import { ListController } from "@web/views/list/list_controller";
import { useSignViewButtons } from "@sign/views/hooks";
import { Dropdown, DropdownItem } from "@web/core/dropdown/dropdown";

export class SignListController extends ListController {
    static template = "sign.SignListController";
    static components = {
        ...ListController.components,
        Dropdown,
        DropdownItem,
    };

    setup() {
        super.setup(...arguments);
        const functions = useSignViewButtons();
        Object.assign(this, functions);
    }
}
