/** @odoo-module **/

/**
 * Adapt the step that is specific to the work details when the `worksheet` module is not installed.
 */

import { markup } from "@odoo/owl";

import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";

import "@industry_fsm/js/tours/industry_fsm_tour";

patch(registry.category("web_tour.tours").get("industry_fsm_tour"), {
    steps() {
        const originalSteps = super.steps();
        const fsmStartStepIndex = originalSteps.findIndex((step) => step.id === "fsm_start");
        originalSteps.splice(
            fsmStartStepIndex + 1,
            0,
            {
                isActive: ["auto"],
                trigger: 'button[name="action_timer_stop"]',
            },
            {
            trigger: 'button[name="action_fsm_worksheet"]',
            content: markup(_t('Open your <b>worksheet</b> in order to fill it in with the details of your intervention.')),
            position: 'bottom',
                run: "click",
            },
            {
                isActive: ["auto"],
            trigger: 'nav.o_main_navbar, button[name="action_generate_new_template"]',
            run: async function () {
                await new Promise((r) => setTimeout(r, 300));
                const createTemplateBtn = document.querySelector('button[name="action_generate_new_template"]');
                if (createTemplateBtn) {
                    createTemplateBtn.click();
                }
            },
            },
            {
                isActive: ["auto"],
                trigger: '.o_control_panel:not(:has(button[name="action_fsm_worksheet"]))',
            },
            {
            trigger: '.o_form_sheet div[name]',
            content: markup(_t('Fill in your <b>worksheet</b> with the details of your intervention.')),
            run: function (actions) {
                //Manage the text on both htmlElement and others fields as this step is dependent on
                // the worksheet template that is set.
                const htmlFieldSelector = '.note-editable.odoo-editor-editable p';
                const inputFieldSelector = 'input';
                const textTriggerElement = this.anchor.querySelector(htmlFieldSelector)
                    || this.anchor.querySelector(inputFieldSelector)
                    || this.anchor;
                actions.edit('My intervention details', textTriggerElement);
            },
            position: 'bottom',
            },
            {
                in_modal: false,
                isActive: ["auto"],
                trigger: ".o_form_button_save",
                run: "click",
            },
            {
            trigger: ".breadcrumb-item.o_back_button:nth-of-type(2)",
            content: markup(_t("Use the breadcrumbs to return to your <b>task</b>.")),
                position: "bottom",
                run: "click",
            }
        );

        const fsmTimerStopStepIndex = originalSteps.findIndex(
            (step) => step.id === "fsm_save_timesheet"
        );
        originalSteps.splice(
            fsmTimerStopStepIndex + 1,
            0,
            {
                in_modal: false,
                isActive: ["auto"],
                trigger: ".o_form_project_tasks",
            },
            {
            trigger: 'button[name="action_preview_worksheet"]',
            content: markup(_t('<b>Review and sign</b> the <b>task report</b> with your customer.')),
            position: 'bottom',
                run: "click",
            },
            {
                in_modal: false,
                isActive: ["auto"],
                trigger: ".o_project_portal_sidebar",
            },
            {
            trigger: 'a[data-bs-target="#modalaccept"]',
            content: markup(_t('Invite your customer to <b>validate and sign your task report</b>.')),
            position: 'right',
            id: 'sign_report',
                run: "click",
            },
            {
                in_modal: false,
                isActive: ["auto"],
                trigger: ".o_project_portal_sidebar",
            },
            {
                isActive: ["auto"],
            trigger: 'div[name="worksheet_map"] h5#task_worksheet',
            content: ('"Worksheet" section is rendered'),
                run: "click",
            },
            {
                in_modal: false,
                isActive: ["auto"],
                trigger: ".o_project_portal_sidebar",
            },
            {
                isActive: ["auto"],
            trigger: 'div[name="worksheet_map"] div[class*="row"] div:not(:empty)',
            content: ('At least a field is rendered'),
                run: "click",
            },
            {
            trigger: '.o_web_sign_auto_button',
            content: markup(_t('Save time by automatically generating a <b>signature</b>.')),
            position: 'right',
                run: "click",
            },
            {
                in_modal: false,
                isActive: ["auto"],
                trigger: ".o_project_portal_sidebar",
            },
            {
            trigger: '.o_portal_sign_submit:enabled',
            content: markup(_t('Validate the <b>signature</b>.')),
            position: 'left',
                run: "click",
            },
            {
                in_modal: false,
                isActive: ["auto"],
                trigger: ".o_project_portal_sidebar",
            },
            {
            trigger: 'a:contains(Back to edit mode)',
            content: markup(_t('Go back to your Field Service <b>task</b>.')),
            position: 'right',
                run: "click",
            },
            {
                in_modal: false,
                isActive: ["auto"],
                trigger: ".o_form_project_tasks",
            },
            {
            trigger: 'button[name="action_send_report"]',
            content: markup(_t('<b>Send your task report</b> to your customer.')),
            position: 'bottom',
                run: "click",
            },
            {
            trigger: 'button[name="document_layout_save"]',
            content: markup(_t('Customize your <b>layout</b>.')),
            position: 'right',
                run: "click",
            },
            {
                in_modal: false,
                isActive: ["auto"],
                trigger: ".o_form_project_tasks",
            },
            {
            trigger: 'button[name="action_send_mail"]',
            content: markup(_t('<b>Send your task report</b> to your customer.')),
            position: 'right',
                run: "click",
            }
        );
        return originalSteps;
    },
});
