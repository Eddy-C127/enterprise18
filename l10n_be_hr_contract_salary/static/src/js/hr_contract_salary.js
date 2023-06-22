/** @odoo-module **/

import hrContractSalary from "@hr_contract_salary/js/hr_contract_salary";
import { renderToElement } from "@web/core/utils/render";

hrContractSalary.include({
    events: Object.assign({}, hrContractSalary.prototype.events, {
        "change input[name='has_hospital_insurance_radio']": "onchangeHospital",
        "change input[name='fold_company_car_total_depreciated_cost']": "onchangeCompanyCar",
        "change input[name='fold_private_car_reimbursed_amount']": "onchangePrivateCar",
        "change input[name='fold_company_bike_depreciated_cost']": "onchangeCompanyBike",
        "change input[name='l10n_be_has_ambulatory_insurance_radio']": "onchangeAmbulatory",
        "change input[name='children']": "onchangeChildren",
        "change input[name='fold_wishlist_car_total_depreciated_cost']": "onchangeWishlistCar",
    }),

    getBenefits() {
        var res = this._super.apply(this, arguments);
        res.contract.l10n_be_canteen_cost = parseFloat($("input[name='l10n_be_canteen_cost']").val() || "0.0");
        return res
    },

    updateGrossToNetModal(data) {
        this._super(data);
        $("input[name='double_holiday_wage']").val(data['double_holiday_wage']);
        if (data["wishlist_simulation"]) {
            const modal_body = renderToElement('hr_contract_salary.salary_package_resume', {
                'lines': data.wishlist_simulation.resume_lines_mapped,
                'categories': data.wishlist_simulation.resume_categories,
                'hide_details': true
            });
            this.$('main[name="wishlist_modal_body"]').html(modal_body);
        }
    },

    onchangeCompanyCar: function(event) {
        var private_car_input = $("input[name='fold_private_car_reimbursed_amount']")
        if (event.target.checked && private_car_input.length && private_car_input[0].checked) {
            private_car_input.click()
        }

        var company_bike_input = $("input[name='fold_company_bike_depreciated_cost']")
        if (event.target.checked && company_bike_input.length && company_bike_input[0].checked) {
            company_bike_input.click()
        }
    },

    onchangePrivateCar: function(event) {
        var company_car_input = $("input[name='fold_company_car_total_depreciated_cost']")
        if (event.target.checked && company_car_input.length && company_car_input[0].checked) {
            company_car_input.click()
        }
    },

    onchangeCompanyBike: function(event) {
        var company_car_input = $("input[name='fold_company_car_total_depreciated_cost']")
        if (event.target.checked && company_car_input.length && company_car_input[0].checked) {
            company_car_input.click()
        }
    },

    onchangeWishlistCar: function(event) {
        if (event.target.checked) {
            const $button = $('<a/>', {
                class: 'btn btn-link ps-0 pt-0 pb-2 m-3',
                role: 'button',
                'data-bs-toggle': 'modal',
                'data-bs-target': '#hr_cs_modal_wishlist',
                'data-bs-backdrop': 'false',
                'data-bs-dismiss': 'modal',
                name: 'wishlist_simulation_button',
                text: 'Simulation',
            });
            const $element_next_to_select = this.$('input[name="wishlist_car_total_depreciated_cost"]').parent();
            $button.insertAfter($element_next_to_select);
        } else {
            const wishlistSimulationButton = document.querySelector('a[name="wishlist_simulation_button"]');
            if (wishlistSimulationButton){
                wishlistSimulationButton.remove();
            }
        }
    },


    onchangeFoldedResetInteger(benefitField) {
        if (benefitField === 'private_car_reimbursed_amount_manual' || benefitField === 'l10n_be_bicyle_cost_manual') {
            return false;
        } else {
            return this._super.apply(this, arguments);
        }
    },

    start: async function () {
        const res = await this._super(...arguments);
        this.onchangeChildren();
        this.onchangeHospital();
        $("input[name='insured_relative_children']").parent().addClass('d-none');
        $("input[name='insured_relative_adults']").parent().addClass('d-none');
        $("input[name='insured_relative_spouse']").parent().addClass('d-none');
        $("input[name='l10n_be_hospital_insurance_notes']").parent().addClass('d-none');
        $("input[name='insured_relative_children_manual']").before($('<strong>', {
            class: 'mt8',
            text: '# Children < 19'
        }));
        $("input[name='insured_relative_adults_manual']").before($('<strong>', {
            class: 'mt8',
            text: '# Children >= 19'
        }));
        $("textarea[name='l10n_be_hospital_insurance_notes_text']").before($('<strong>', {
            class: 'mt8',
            text: 'Additional Information'
        }));
        this.onchangeAmbulatory();
        $("input[name='l10n_be_ambulatory_insured_children']").parent().addClass('d-none');
        $("input[name='l10n_be_ambulatory_insured_adults']").parent().addClass('d-none');
        $("input[name='l10n_be_ambulatory_insured_spouse']").parent().addClass('d-none');
        $("input[name='l10n_be_ambulatory_insurance_notes']").parent().addClass('d-none');
        $("input[name='l10n_be_ambulatory_insured_children_manual']").before($('<strong>', {
            class: 'mt8',
            text: '# Children < 19'
        }));
        $("input[name='l10n_be_ambulatory_insured_adults_manual']").before($('<strong>', {
            class: 'mt8',
            text: '# Children >= 19'
        }));
        $("textarea[name='l10n_be_ambulatory_insurance_notes_text']").before($('<strong>', {
            class: 'mt8',
            text: 'Additional Information'
        }));
        return res;
    },

    onchangeHospital: function() {
        const hasInsurance = $("input[name='has_hospital_insurance_radio']:last").prop('checked');
        if (hasInsurance) {
            // Show fields
            $("label[for='insured_relative_children']").parent().removeClass('d-none');
            $("label[for='insured_relative_adults']").parent().removeClass('d-none');
            $("label[for='insured_relative_spouse']").parent().removeClass('d-none');
            $("label[for='l10n_be_hospital_insurance_notes']").parent().removeClass('d-none');
        } else {
            // Reset values
            $("input[name='fold_insured_relative_spouse']").prop('checked', false);
            $("input[name='insured_relative_children_manual']").val(0);
            $("input[name='insured_relative_adults_manual']").val(0);
            // Hide fields
            $("label[for='insured_relative_children']").parent().addClass('d-none');
            $("label[for='insured_relative_adults']").parent().addClass('d-none');
            $("label[for='insured_relative_spouse']").parent().addClass('d-none');
            $("label[for='l10n_be_hospital_insurance_notes']").parent().addClass('d-none');
        }
    },

    onchangeAmbulatory: function() {
        const hasInsurance = $("input[name='l10n_be_has_ambulatory_insurance_radio']:last").prop('checked');
        if (hasInsurance) {
            // Show fields
            $("label[for='l10n_be_ambulatory_insured_children']").parent().removeClass('d-none');
            $("label[for='l10n_be_ambulatory_insured_adults']").parent().removeClass('d-none');
            $("label[for='l10n_be_ambulatory_insured_spouse']").parent().removeClass('d-none');
            $("label[for='l10n_be_ambulatory_insurance_notes']").parent().removeClass('d-none');
        } else {
            // Reset values
            $("input[name='fold_l10n_be_ambulatory_insured_spouse']").prop('checked', false);
            $("input[name='l10n_be_ambulatory_insured_children_manual']").val(0);
            $("input[name='l10n_be_ambulatory_insured_adults_manual']").val(0);
            // Hide fields
            $("label[for='l10n_be_ambulatory_insured_children']").parent().addClass('d-none');
            $("label[for='l10n_be_ambulatory_insured_adults']").parent().addClass('d-none');
            $("label[for='l10n_be_ambulatory_insured_spouse']").parent().addClass('d-none');
            $("label[for='l10n_be_ambulatory_insurance_notes']").parent().addClass('d-none');
        }
    },

    onchangeChildren(event) {
        const disabledChildren = $("input[name='disabled_children_bool']");
        const disabledChildrenNumber = $("input[name='disabled_children_number']");
        const childCount = parseInt(event && event.currentTarget && event.currentTarget.value);

        if (isNaN(childCount) || childCount === 0) {
            disabledChildrenNumber.val(0);

            if (disabledChildren.prop('checked')) {
                disabledChildren.click();
            }
            disabledChildren.parent().addClass('d-none');
        } else {
            disabledChildren.parent().removeClass('d-none');
        }
    },
});
