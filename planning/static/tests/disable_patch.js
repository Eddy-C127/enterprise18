/** @odoo-module */

import {
    unpatchM2oResourceFieldPlanning,
    unpatchKanbanM2oResourceFieldPlanning
} from "@planning/views/fields/many2one_avatar_resource/many2one_avatar_resource_field_patch";

unpatchM2oResourceFieldPlanning();
unpatchKanbanM2oResourceFieldPlanning();
