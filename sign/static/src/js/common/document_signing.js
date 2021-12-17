/** @odoo-module alias=sign.document_signing **/

// Signing part
'use strict';

import ajax from 'web.ajax';
import config from 'web.config';
import core from 'web.core';
import { debounce } from "@web/core/utils/timing";
import Dialog from 'web.Dialog';
import { Document } from '@sign/js/common/document';
import { NameAndSignature } from 'web.name_and_signature';
import { PDFIframe } from '@sign/js/common/PDFIframe';
import session from 'web.session';
import Widget from 'web.Widget';
import time from 'web.time';
import { multiFileUpload } from '@sign/js/common/multi_file_upload';

const _t = core._t;

// The goal of this override is to fetch a default signature if one was
// already set by the user for this request.
const SignNameAndSignature = NameAndSignature.extend({

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    /**
     * Adds requestID and accessToken.
     *
     * @constructor
     * @param {Widget} parent
     * @param {Object} options
     * @param {number} requestID
     * @param {string} accessToken
     */
    init: function (parent, options, requestID, accessToken) {
        this._super.apply(this, arguments);

        this.requestID = requestID;
        this.accessToken = accessToken;

        this.defaultSignature = '';
        this.signatureChanged = false;
    },
    /**
     * Fetches the existing signature.
     *
     * @override
     */
    willStart: function () {
        const self = this;
        return Promise.all([
            this._super.apply(this, arguments),
            self._rpc({
                route: '/sign/get_signature/' + self.requestID + '/' + self.accessToken,
                params: {
                    signature_type: self.signatureType,
                },
            }).then(function (signature) {
                if (signature) {
                    signature = 'data:image/png;base64,' + signature;
                    self.defaultSignature = signature;
                }
            })
        ]);
    },
    /**
     * Sets the existing signature.
     *
     * @override
     */
    resetSignature: function () {
        const self = this;
        return this._super.apply(this, arguments).then(function () {
            if (self.defaultSignature && self.defaultSignature !== self.emptySignature) {
                const settings = self.$signatureField.jSignature('getSettings');
                const decorColor = settings['decor-color'];
                self.$signatureField.jSignature('updateSetting', 'decor-color', null);
                self.$signatureField.jSignature('reset');
                self.$signatureField.jSignature("importData", self.defaultSignature);
                settings['decor-color'] = decorColor;

                return self._waitForSignatureNotEmpty();
            }
        });
    },
    //----------------------------------------------------------------------
    // Handlers
    //----------------------------------------------------------------------

    /**
     * Override: If a user clicks on load, we overwrite the signature in the server.
     * 
     * @see NameAndSignature._onChangeSignLoadInput()
     * @private
     */
    _onChangeSignLoadInput: function () {
        this.signatureChanged = true;
        return this._super.apply(this, arguments);
    },
    /**
     * If a user clicks on draw, we overwrite the signature in the server.
     * 
     * @override
     * @see NameAndSignature._onClickSignDrawClear()
     * @private
     */
    _onClickSignDrawClear: function () {
        this.signatureChanged = true;
        return this._super.apply(this, arguments);
    },
    /**
     * If a user clicks on auto, we overwrite the signature in the server.
     * 
     * @override
     * @see NameAndSignature._onClickSignAutoButton()
     * @private
     */
    _onClickSignAutoButton: function () {
        this.signatureChanged = true;
        return this._super.apply(this, arguments);
    },
    /**
     * If a user clicks on draw, we overwrite the signature in the server.
     * 
     * @override
     * @see NameAndSignature._onClickSignDrawButton()
     * @private
     */
    _onClickSignDrawButton: function () {
        this.signatureChanged = true;
        return this._super.apply(this, arguments);
    },
});

// The goal of this dialog is to ask the user a signature request.
// It uses @see SignNameAndSignature for the name and signature fields.
const SignatureDialog = Dialog.extend({
    template: 'sign.signature_dialog',

    custom_events: {
        'signature_changed': '_onChangeSignature',
    },

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    /**
     * Allows options.
     *
     * @constructor
     * @param {Widget} parent
     * @param {Object} options
     * @param {string} [options.title='Adopt Your Signature'] - modal title
     * @param {string} [options.size='medium'] - modal size
     * @param {Object} [options.nameAndSignatureOptions={}] - options for
     *  @see NameAndSignature.init()
     * @param {number} requestID
     * @param {string} accessToken
     */
    init: function (parent, options, requestID, accessToken) {
        options = options || {};

        options.title = options.title || _t("Adopt Your Signature");
        options.size = options.size || 'medium';
        options.technical = false;
        if (config.device.isMobile) {
            options.technical = true;
            options.fullscreen = true;
        }

        if (!options.buttons) {
            options.buttons = this.addDefaultButtons();
        }

        this._super(parent, options);

        this.confirmFunction = function () {};

        this.nameAndSignature = new SignNameAndSignature(this, options.nameAndSignatureOptions, requestID, accessToken);
    },
    /**
     * Start the nameAndSignature widget and wait for it.
     *
     * @override
     */
        willStart: function () {
            return Promise.all([
                this.nameAndSignature.appendTo($('<div>')),
                this._super.apply(this, arguments)
            ]);
        },
    /**
     * Initialize the name and signature widget when the modal is opened.
     *
     * @override
     */
    start: function () {
        const self = this;
        this.$primaryButton = this.$footer.find('.btn-primary');
        this.$secondaryButton = this.$footer.find('.btn-secondary');
        this.opened().then(function () {
            self.$('.o_web_sign_name_and_signature').replaceWith(self.nameAndSignature.$el);
            // initialize the signature area
            self.nameAndSignature.resetSignature();
        });
        return this._super.apply(this, arguments);
    },

    onConfirm: function (fct) {
        this.confirmFunction = fct;
    },

    onConfirmAll: function (fct) {
        this.confirmAllFunction = fct;
    },

    addDefaultButtons () {
        const buttons = [];
        buttons.push({text: _t("Cancel"), close: true});
        buttons.push({text: _t("Sign all"), classes: "btn-secondary", disabled: true, click: (e) => {
            //this.confirmAllFunction is undefined in documents with no sign items
            this.confirmAllFunction ? this.confirmAllFunction() : this.confirmFunction();
        }});
        buttons.push({text: _t("Adopt and Sign"), classes: "btn-primary", disabled: true, click: (e) => {
            this.confirmFunction();
        }});
        return buttons;
    },

    /**
     * Gets the name currently given by the user.
     *
     * @see NameAndSignature.getName()
     * @returns {string} name
     */
    getName: function () {
        return this.nameAndSignature.getName();
    },
    /**
     * Gets the signature currently drawn.
     *
     * @see NameAndSignature.getSignatureImage()
     * @returns {string[]} Array that contains the signature as a bitmap.
     *  The first element is the mimetype, the second element is the data.
     */
    getSignatureImage: function () {
        return this.nameAndSignature.getSignatureImage();
    },
    /**
     * Gets the signature currently drawn, in a format ready to be used in
     * an <img/> src attribute.
     *
     * @see NameAndSignature.getSignatureImageSrc()
     * @returns {string} the signature currently drawn, src ready
     */
    getSignatureImageSrc: function () {
        return this.nameAndSignature.getSignatureImageSrc();
    },
    /**
     * Returns whether the drawing area is currently empty.
     *
     * @see NameAndSignature.isSignatureEmpty()
     * @returns {boolean} Whether the drawing area is currently empty.
     */
    isSignatureEmpty: function () {
        return this.nameAndSignature.isSignatureEmpty();
    },
    /**
     * Gets the current name and signature, validates them, and
     * returns the result. If they are invalid, it also displays the
     * errors to the user.
     *
     * @see NameAndSignature.validateSignature()
     * @returns {boolean} whether the current name and signature are valid
     */
    validateSignature: function () {
        return this.nameAndSignature.validateSignature();
    },

    //----------------------------------------------------------------------
    // Handlers
    //----------------------------------------------------------------------

    /**
     * Toggles the submit button depending on the signature state.
     *
     * @private
     */
    _onChangeSignature: function () {
        const isEmpty = this.nameAndSignature.isSignatureEmpty();
        this.$primaryButton.prop('disabled', isEmpty);
        this.$secondaryButton.prop('disabled', isEmpty);
    },
    /**
     * @override
     */
    renderElement: function () {
        this._super.apply(this, arguments);
        // this trigger the adding of a custom css
        this.$modal.addClass('o_sign_signature_dialog');
    },
});

const SignItemNavigator = Widget.extend({
    className: 'o_sign_sign_item_navigator',

    events: {
        'click': 'onClick'
    },

    init: function(parent, types) {
        this._super(parent);

        this.types = types;
        this.started = false;
        this.isScrolling = false;
    },

    start: function() {
        this.$signatureItemNavLine = $('<div/>').addClass("o_sign_sign_item_navline").insertBefore(this.$el);
        this.setTip(_t("Click to start"));
        this.$el.focus();

        return this._super();
    },

    setTip: function(tip) {
        this.$el.text(tip);
    },

    onClick: function(e) {
        this.goToNextSignItem();
    },

    goToNextSignItem() {
        const self = this;

        if(!self.started) {
            self.started = true;

            self.getParent().$iframe.prev().animate({'height': '0px', 'opacity': 0}, {
                duration: 750,
                complete: function() {
                    self.getParent().$iframe.prev().hide();
                    self.getParent().refreshSignItems();

                    self.goToNextSignItem();
                }
            });

            return false;
        }

        const $signItemsToComplete = self.getParent().checkSignItemsCompletion().sort((a, b) => {
            return ($(a).data('order') || 0) - ($(b).data('order') || 0);
        });
        if($signItemsToComplete.length > 0) {
            self.scrollToSignItem($signItemsToComplete.first());
        }
    },

    scrollToSignItem: function($item) {
        const self = this;
        if(!this.started) {
            return;
        }
        this._scrollToSignItemPromise($item).then(function () {
            const type = self.types[$item.data('type')];
            if(type.item_type === 'text') {
                $item.val = () => $item.find('input').val();
                $item.focus = () => $item.find('input').focus();
            }

            if($item.val() === "" && !$item.data('signature')) {
                self.setTip(type.tip);
            }

            self.getParent().refreshSignItems();
            $item.focus();
            if (['signature', 'initial'].includes(type.item_type)) {
                $item.data("has-focus") ? $item.click() : $item.data("has-focus", true);
            }
            self.isScrolling = false;
        });

        this.getParent().$('.ui-selected').removeClass('ui-selected');
        $item.addClass('ui-selected').focus();
    },

    _scrollToSignItemPromise($item) {
        if (config.device.isMobile) {
            return new Promise(resolve => {
                this.isScrolling = true;
                $item[0].scrollIntoView({behavior: 'smooth', block: 'center', inline: 'center'});
                resolve();
            });
        }

        const $container = this.getParent().$('#viewerContainer');
        const $viewer = $container.find('#viewer');
        const containerHeight = $container.outerHeight();
        const viewerHeight = $viewer.outerHeight();

        let scrollOffset = containerHeight/4;
        const scrollTop = $item.offset().top - $viewer.offset().top - scrollOffset;
        if(scrollTop + containerHeight > viewerHeight) {
            scrollOffset += scrollTop + containerHeight - viewerHeight;
        }
        if(scrollTop < 0) {
            scrollOffset += scrollTop;
        }
        scrollOffset += $container.offset().top - this.$el.outerHeight()/2 + parseInt($item.css('height')) / 2;

        const duration = Math.min(
            1000,
            5*(Math.abs($container[0].scrollTop - scrollTop) + Math.abs(parseFloat(this.$el.css('top')) - scrollOffset))
        );

        this.isScrolling = true;
        const def1 = new Promise(function (resolve, reject) {
            $container.animate({'scrollTop': scrollTop}, duration, function () {
                resolve();
                core.bus.trigger("resize");
            })
        });
        const def2 = new Promise((resolve, reject) => {
            this.$el.add(this.$signatureItemNavLine).animate({'top': scrollOffset}, duration, function() {
                resolve();
                core.bus.trigger("resize");
            })
        });
        return Promise.all([def1, def2]);
    },
});

const PublicSignerDialog = Dialog.extend({
    template: "sign.public_signer_dialog",
    init (parent, requestID, requestToken, RedirectURL, options) {
        options = (options || {});

        options.title = options.title || _t("Final Validation");
        options.size = options.size || "medium";
        options.technical = false;

        if (config.device.isMobile) {
            options.technical = true;
            options.fullscreen = true;
        }

        if(!options.buttons) {
            this.addDefaultButtons(options);
        }

        this._super(parent, options);

        this.requestID = requestID;
        this.requestToken = requestToken;
        this.sent = new Promise((resolve) => {
            this.sentResolve = resolve;
        });
    },

    addDefaultButtons (options) {
        options.buttons = [];
        options.buttons.push({text: _t("Validate & Send"), classes: "btn-primary", click: (e) => {
            const name = this.inputs[0].value;
            const mail = this.inputs[1].value;
            if(this.validateDialogInputs(name, mail)) {
                this._rpc({
                    route:"/sign/send_public/" + this.requestID + '/' + this.requestToken,
                    params: {
                        name: name,
                        mail: mail,
                    }
                }).then(() => {
                    this.close();
                    this.sentResolve();
                });
            }
        }});
        options.buttons.push({text: _t("Cancel"), close: true});
        this.options = options;
    },

    validateDialogInputs(name, mail) {
        const isEmailInvalid = !mail || mail.indexOf('@') < 0;
        if(!name || isEmailInvalid) {
            this.inputs[0].closest('.form-group').querySelector('.form-control, .custom-select').classList.toggle('is-invalid', !name);
            this.inputs[1].closest('.form-group').querySelector('.form-control, .custom-select').classList.toggle('is-invalid', isEmailInvalid);
            return false;
        }
        return true;
    },

    open (name, mail) {
        this.opened(() => {
            this.inputs = this.el.querySelectorAll('input');
            this.inputs[0].value = name;
            this.inputs[1].value = mail;
        });
        return this._super.apply(this, arguments);
    },
});

const SMSSignerDialog = Dialog.extend({
    template: "sign.public_sms_signer",
    events: {
        'click button.o_sign_resend_sms': function(e) {
            const sendButton = this.el.querySelector('.o_sign_resend_sms');
            sendButton.disabled = true;
            const phoneNumber = this.el.querySelector('#o_sign_phone_number_input').value;
            phoneNumber ? this.sendSMS(phoneNumber, sendButton) : sendButton.removeAttribute('disabled');
        }
    },
    sendSMS (phoneNumber, sendButton) {
        const route = '/sign/send-sms/' + this.requestID + '/' + this.requestToken + '/' + phoneNumber;
        session.rpc(route, {}).then((success) => {
            const errorMessage = _t("Unable to send the SMS, please contact the sender of the document.");
            success ? this.handleSendSMSSuccess(sendButton) : this.handleSMSError(sendButton, errorMessage);
        }).guardedCatch((error) => {
            this.handleSMSError(sendButton);
        });
    },
    handleSendSMSSuccess (button) {
        button.innerHtml = "<span><i class='fa fa-check'/> "+_t("SMS Sent")+"</span>";
        setTimeout(() => {
            button.removeAttribute('disabled');
            button.textContent = _t('Re-send SMS');
        }, 15000);
    },
    handleSMSError (button, message) {
        button.removeAttribute('disabled');
        Dialog.alert(this, message, {
            title: _t("Error"),
        });
    },
    _onValidateSMS() {
        const validateButton = this.$footer[0].querySelector('.o_sign_validate_sms');
        const validationCodeInput = this.el.querySelector('#o_sign_public_signer_sms_input');
        if(!validationCodeInput.value) {
            validationCodeInput.closest('.form-group').querySelector('.form-control, .custom-select').classList.toggle('is-invalid');
            return false;
        }
        const route = '/sign/sign/' + this.requestID + '/' + this.requestToken + '/' + validationCodeInput.value;
        const params = {
            signature: this.signature,
            new_sign_items: this.newSignItems
        };
        validateButton.disabled = true;
        session.rpc(route, params).then((response) => {
            if (!response) {
                const errorMessage = _t("Your signature was not submitted. Ensure that all required field of the documents are completed and that the SMS validation code is correct.");
                this.handleSMSError(validateButton, errorMessage);
            }
            if (response === true) {
                (new (this.get_thankyoudialog_class())(this, this.RedirectURL, this.RedirectURLText,
                    this.requestID, {'nextSign': (this.name_list || []).length})).open();
                this.do_hide();
            }
        });
    },
    get_thankyoudialog_class: function () {
        return ThankYouDialog;
    },
    init: function(parent, requestID, requestToken, signature, newSignItems, signerPhone, RedirectURL, options) {
        options = (options || {});
        if (config.device.isMobile) {
            options.fullscreen = true;
        }
        options.title = options.title || _t("Final Validation");
        options.size = options.size || "medium";
        if(!options.buttons) {
            options.buttons = this.addDefaultButtons();
        }
        this._super(parent, options);
        this.requestID = requestID;
        this.requestToken = requestToken;
        this.signature = signature;
        this.newSignItems = newSignItems;
        this.signerPhone = signerPhone;
        this.RedirectURL = RedirectURL;
        this.sent = $.Deferred();
    },
    addDefaultButtons() {
        return [{
            text: _t("Verify"),
            classes: "btn btn-primary o_sign_validate_sms",
            click: this._onValidateSMS
        }];
    }
});

const EncryptedDialog = Dialog.extend({
    template: "sign.public_password",

    _onValidatePassword: function () {
        const input = this.$('#o_sign_public_signer_password_input');
        if(!input.val()) {
            input.closest('.form-group').toggleClass('o_has_error').find('.form-control, .custom-select').toggleClass('is-invalid');
            return false;
        }
        const route = '/sign/password/' + this.requestID ;
        const params = {
            password: input.val()
        };
        const self = this;
        session.rpc(route, params).then(function(response) {
            if (!response) {
                Dialog.alert(self, _t("Password is incorrect."), {
                    title: _t("Error"),
                });
            }
            if (response === true) {
                self.close();
            }
        });
    },

    init: function(parent, requestID, options) {
        options = (options || {});
        if (config.device.isMobile) {
            options.fullscreen = true;
        }
        options.title = options.title || _t("PDF is encrypted");
        options.size = options.size || "medium";
        if(!options.buttons) {
            options.buttons = this.addDefaultButtons();
        }
        this._super(parent, options);
        this.requestID = requestID;
    },

    /**
     * @override
     */
    renderElement: function () {
        this._super.apply(this, arguments);
        this.$modal.find('button.close').addClass('invisible');
    },
    addDefaultButtons () {
        return [{
            text: _t("Generate PDF"),
            classes: "btn btn-primary o_sign_validate_encrypted",
            click: this._onValidatePassword
        }];
    }
});

const ThankYouDialog = Dialog.extend({
    events: {
        'click .o_go_to_document': 'on_closed',
    },

    get_passworddialog_class: function () {
        return EncryptedDialog;
    },

    init: function(parent, RedirectURL, RedirectURLText, requestID, options) {
        options = (options || {});
        options.title = options.title || _t("Thank You !");
        options.subtitle = options.subtitle || _t("Your signature has been saved.");
        options.size = options.size || "medium";
        options.technical = false;
        options.buttons = [];
        if (RedirectURL) {
            // check if url contains http:// or https://
            if (!/^(f|ht)tps?:\/\//i.test(RedirectURL)) {
                RedirectURL = "http://" + RedirectURL;
                }
            options.buttons.push({text: RedirectURLText, classes: 'btn-primary', click: function (e) {
                window.location.replace(RedirectURL);
            }});
        }
        this.options = options;
        this.has_next_document = false;
        this.RedirectURL = RedirectURL;
        this.requestID = requestID;

        this._super(parent, options);

        this.on('closed', this, this.on_closed);
        this._rpc({
            route: '/sign/encrypted/' + requestID
        }).then((response) => {
            if (response === true) {
                (new (this.get_passworddialog_class())(this, requestID)).open();
            }
        });

    },
    //TODO find a better strategy dealing with buttons
    start: async function () {
        let result = false;
        const nextTemplate = multiFileUpload.getNext();
        const canReadRequestItem = await session.user_has_group('sign.group_sign_user');
        if (canReadRequestItem) {
            result = await this._rpc({
                model: 'sign.request.item',
                method: 'search_read',
                domain: ['&','&', ['partner_id', '=', session.partner_id], ['state', '=', 'sent'], ['id', '!=', this.requestID]],
                fields: ['sign_request_id'],
                orderBy: [{name: 'create_date', desc: true}]
            });
        }

        const openDocumentButton = {
            text: _t('View Document'),
            click: e => {
                if (canReadRequestItem) {
                    this._rpc({
                        model: 'sign.request',
                        method: 'go_to_document',
                        args: [this.requestID],
                    }).then(action => {
                        this.do_action(action, {clear_breadcrumbs: true});
                    });
                } else {
                    window.location.reload();
                }
            }
        };

        if (nextTemplate && nextTemplate.template) {
            openDocumentButton.classes = 'btn-secondary';
            this.options.buttons.push(openDocumentButton);

            this.options.buttons.push({
                text: _t('Next Document'), classes: 'btn-primary', click: (e) => {
                    multiFileUpload.removeFile(nextTemplate.template);
                    this.do_action({
                        type: "ir.actions.client",
                        tag: 'sign.Template',
                        name: core.utils.sprintf(_t(`Template "%s"`), nextTemplate.name),
                        context: {
                            sign_edit_call: 'sign_send_request',
                            id: nextTemplate.template,
                            sign_directly_without_mail: false,
                        }
                    }, {clear_breadcrumbs: true});
                }
            });

        } else if (result && result.length) {
            this.has_next_document = true;

            openDocumentButton.classes = 'btn-secondary';
            this.options.buttons.push(openDocumentButton);

            this.next_document = result.reduce((prev, curr) => {
                return (Math.abs(curr.sign_request_id[0] - this.requestID) <= Math.abs(prev.sign_request_id[0] - this.requestID) ? curr : prev);
            });
            this.options.buttons.push({
                text: _t('Sign Next Document'), classes: 'btn-primary', click: (e) => {
                    this._rpc({
                        model: 'sign.request',
                        method: 'go_to_document',
                        args: [this.next_document.sign_request_id[0]],
                    }).then(action => {
                        this.do_action(action, {clear_breadcrumbs: true});
                    });
                }
            });
        } else {
            openDocumentButton.classes = 'btn-primary';
            if (!this.RedirectURL) {
                this.options.buttons.push(openDocumentButton);
            }
        }
        this.setElement($(core.qweb.render('sign.thank_you_dialog', {widget: this})));
        this.set_buttons(this.options.buttons);
        await this.renderElement();
    },

    /**
     * @override
     */
    renderElement: function () {
        this._super.apply(this, arguments);
        // this trigger the adding of a custom css
        this.$modal.addClass('o_sign_thank_you_dialog');
        this.$modal.find('button.close').addClass('invisible');
        this.$modal.find('.modal-header .o_subtitle').before('<br/>');
    },

    on_closed: function () {
        window.location.reload();
    },
});

const NextDirectSignDialog = Dialog.extend({
    template: "sign.next_direct_sign_dialog",
    events: {
        'click .o_go_to_document': 'on_closed',
        'click .o_nextdirectsign_link': 'on_click_next',
    },

    init: function(parent, RedirectURL, requestID, options) {
        this.token_list = (parent.token_list || {});
        this.name_list = (parent.name_list || {});
        this.requestID = parent.requestID;
        this.create_uid = parent.create_uid;
        this.state = parent.state;

        options = (options || {});
        options.title = options.title || _t("Thank You !") + "<br/>";
        options.subtitle = options.subtitle || _t("Your signature has been saved.") + " " + core.utils.sprintf(_t(`Next signatory is "%s"`), this.name_list[0]);
        options.size = options.size || "medium";
        options.technical = false;
        if (config.device.isMobile) {
            options.technical = true;
            options.fullscreen = true;
        }
        options.buttons = [{text: core.utils.sprintf(_t(`Next signatory ("%s")`), this.name_list[0]), click: this.on_click_next}],
        this.options = options;
        this.RedirectURL = "RedirectURL";
        this.requestID = requestID;
        this._super(parent, options);
    },

    /**
     * @override
     */
    renderElement: function () {
        this._super.apply(this, arguments);
        this.$modal.addClass('o_sign_next_dialog');
        this.$modal.find('button.close').addClass('invisible');
    },

    on_click_next: function () {
        const newCurrentToken = this.token_list.shift();
        const newCurrentName = this.name_list.shift();

        this.do_action({
            type: "ir.actions.client",
            tag: 'sign.SignableDocument',
            name: _t("Sign"),
        }, {
            additional_context: {
                id: this.requestID,
                create_uid: this.create_uid,
                state: this.state,
                token: newCurrentToken,
                sign_token: newCurrentToken,
                token_list: this.token_list,
                name_list: this.name_list,
                current_signor_name: newCurrentName,
            },
            replace_last_action: true,
        });

        this.destroy();
    },
});

const SignablePDFIframe = PDFIframe.extend({
    init: function() {
        this._super.apply(this, arguments);
        this.events = Object.assign(this.events || {}, {
            'keydown .page .ui-selected': function(e) {
                if((e.keyCode || e.which) !== 13) {
                    return true;
                }
                e.preventDefault();
                this.signatureItemNav.goToNextSignItem();
            },
        });
        this.nextSignature = '';
        this.nextInitial = '';
    },
    /**
     * Fetches the signature of the user
     * @param { String } signatureType 'signature' or 'initial'
     * @returns 
     */
    fetchSignature: function (signatureType='signature') {
        const shouldRequestSignature = Object.values(this.signatureItems).some((currentSignature) => {
            return this.types[currentSignature.type].item_type === signatureType
        });

        if (shouldRequestSignature) {
            return this._rpc({
                route: '/sign/get_signature/' + this.getParent().requestID + '/' + this.getParent().accessToken,
                params: {
                    signature_type: signatureType,
                },
            }).then(signature => {
                if (signature) {
                    signature = 'data:image/png;base64,' + signature;
                    if (signatureType === 'signature') {
                        this.nextSignature = signature;
                    } else {
                        this.nextInitial = signature
                    }
                }
            });
        }
    },

    doPDFPostLoad: function() {
        Promise.all([
            this.fullyLoaded,
            this.fetchSignature('signature'),
            this.fetchSignature('initial')
        ]).then(() => {
            this.signatureItemNav = new SignItemNavigator(this, this.types);
            return this.signatureItemNav.prependTo(this.$('#viewerContainer')).then(() => {
                this.checkSignItemsCompletion();
                this.$('#viewerContainer').on('scroll', (e) => {
                    if(!this.signatureItemNav.isScrolling && this.signatureItemNav.started) {
                        this.signatureItemNav.setTip(_t('next'));
                    }
                });
            });
        });

        this._super.apply(this, arguments);
    },

    createSignItem: function(type, required, responsible, posX, posY, width, height, value, options, name, tooltip, alignment, isSignItemEditable) {
        // jQuery.data parse 0 as integer, but 0 is not considered falsy for signature item
        if (value === 0) {
            value = "0";
        }
        const $signatureItem = this._super.apply(this, arguments);
        const readonly = this.readonlyFields || (responsible > 0 && responsible !== this.role) || !!value;
        if(!readonly) {
            // Do not display the placeholder of Text and Multiline Text if the name of the item is the default one.
            if (['text', 'textarea'].includes(type.name) && type.placeholder === $signatureItem.prop('placeholder')) {
                $signatureItem.attr('placeholder', ' ');
                $signatureItem.find(".o_placeholder").text(" ");
            }
            this.registerCreatedSignItemEvents($signatureItem, type, isSignItemEditable);
        } else {
            $signatureItem.val(value);
        }
        return $signatureItem;
    },
    /**
     * Fills text sign item with value
     * @param { jQuery } $signatureItem sign item
     * @param { String } value 
     */
    fillTextSignItem ($signatureItem, value) {
        if($signatureItem.val() === "") {
            $signatureItem.val(value);
            $signatureItem.trigger('input');
        }
    },

    /**
     * 
     * @param { jQuery } $signatureItem 
     * @param { Object } type type of sign item 
     * @param { Boolean } isSignItemEditable flag for sign item added while signing
     */
    registerCreatedSignItemEvents($signatureItem, type, isSignItemEditable) {
        if (type.name === _t("Date")) {
            $signatureItem.on('focus', e => this.fillTextSignItem($signatureItem, moment().format(time.getLangDateFormat())));
        }
        if (type.item_type === "signature" || type.item_type === "initial") {
            // in edit while signing mode, both edit and sign are possible.
            // So we sign when .o_sign_item_display is clicked, instead of a click in the signatureItem
            const clickableSignItem = isSignItemEditable ? $signatureItem.find('.o_sign_item_display') : $signatureItem;
            clickableSignItem.on('click', debounce(() => this.handleSignatureDialogClick($signatureItem, type), 800));
        }

        if(type.auto_field) {
            $signatureItem.on('focus', e => this.fillTextSignItem($signatureItem, type.auto_field));
        }

        if (config.device.isMobile && ['text', 'textarea'].includes(type.item_type)) {
            const inputBottomSheet = new InputBottomSheet(this, {
                type: type.item_type,
                value: $signatureItem.val(),
                label: `${type.tip}: ${type.placeholder}`,
                placeholder: $signatureItem.attr('placeholder'),
                onTextChange: (value) => {
                    $signatureItem.val(value);
                },
                onValidate: (value) => {
                    $signatureItem.val(value);
                    $signatureItem.trigger('input');
                    inputBottomSheet.hide();
                    this.signatureItemNav.goToNextSignItem();
                },
            });
            inputBottomSheet.appendTo(document.body);

            $signatureItem.on('focus', () => {
                inputBottomSheet.updateInputText($signatureItem.val());
                inputBottomSheet.show();
            });
        }

        $signatureItem.on('input', e => {
            this.checkSignItemsCompletion(this.role);
            this.signatureItemNav.setTip(_t('next'));
        });
    },
    /**
     * Logic for wizard/mark behavior is: 
     * If type is signature, nextSignature is defined and the item is not marked yet, the default signature is used
     * Else, wizard is opened.
     * If type is initial, other initial items were already signed and item is not marked yet, the previous initial is used
     * Else, wizard is opened.
     * @param { jQuery } $signatureItem 
     * @param { Object } type 
     */
    handleSignatureDialogClick($signatureItem, type) {
        this.refreshSignItems();
        if (type.item_type === "signature" && this.nextSignature && !$signatureItem.data('signature')) {
            this.adjustSignatureSize(this.nextSignature, $signatureItem).then(data => {
                $signatureItem.data('signature', data)
                    .empty().append($('<span/>').addClass("o_sign_helper"), $('<img/>', {src: $signatureItem.data('signature')}));
                $signatureItem.trigger('input');
            });
        } else if (type.item_type === "initial" && this.nextInitial && !$signatureItem.data('signature')) {
            this.adjustSignatureSize(this.nextInitial, $signatureItem).then(data => {
                $signatureItem.data('signature', data)
                    .empty().append($('<span/>').addClass("o_sign_helper"), $('<img/>', {src: $signatureItem.data('signature')}));
                $signatureItem.trigger('input');
            })
        } else {
            this.openSignatureDialog($signatureItem, type);
        }
    },

    openSignatureDialog($signatureItem, type) {
        const nameAndSignatureOptions = {
            defaultName: this.getParent().signerName || "",
            fontColor: 'DarkBlue',
            signatureType: type.item_type,
            displaySignatureRatio: parseFloat($signatureItem.css('width')) / parseFloat($signatureItem.css('height')),
        };
        const signDialog = new SignatureDialog(this, {nameAndSignatureOptions: nameAndSignatureOptions}, this.getParent().requestID, this.getParent().accessToken);

        signDialog.open().onConfirm(() => {
            if (!signDialog.isSignatureEmpty()) {
                const name = signDialog.getName();
                const signature = signDialog.getSignatureImageSrc();
                this.getParent().signerName = name;

                this.updateNextSignatureOrInitial(type.item_type, signature);

                if(signDialog.nameAndSignature.signatureChanged) {
                    this.updateUserSignature(type.item_type, signature);
                }

                $signatureItem.data({
                    'signature': signature,
                }).empty().append($('<span/>').addClass("o_sign_helper"), $('<img/>', {src: $signatureItem.data('signature')}));
            } else {
                $signatureItem.removeData('signature')
                .empty()
                .append($('<span/>').addClass("o_sign_helper"), type.placeholder);
            }

            $signatureItem.trigger('input').focus();
            signDialog.close();
        });

        signDialog.onConfirmAll(async () => {
            for (const pageNumber of Object.keys(this.configuration)) {
                const page = this.configuration[pageNumber];
                const name = signDialog.getName();
                const signature = signDialog.getSignatureImageSrc();
                this.getParent().signerName = name;

                this.updateNextSignatureOrInitial(type.item_type, signature);

                if(signDialog.nameAndSignature.signatureChanged) {
                    this.updateUserSignature(type.item_type, signature)
                }

                await Promise.all(page.reduce((promise, item) => {
                    if (item.data('type') === type.id && item.data('responsible') === this.role) {
                        promise.push(this.adjustSignatureSize(signature, item).then(data => {
                            item.data('signature', data)
                            .empty()
                            .append($('<span/>').addClass("o_sign_helper"), $('<img/>', {src: item.data('signature')}));
                        }));
                    }
                    return promise;
                }, []))
            }
            $signatureItem.trigger('input').focus();
            signDialog.close();
        })
    },

    /**
     * Updates the next signature variable for signature or initial
     * @param { Object } type 
     * @param { String } signature base64 encoded image
     */
    updateNextSignatureOrInitial (type, signature) {
        if (type === 'signature') {
            this.nextSignature = signature
        } else {
            this.nextInitial = signature
        }
    },

    /**
     * Updates the user's signature in the res.user model
     * @param { Object } type 
     * @param { String } signature base64 encoded image
     */
    updateUserSignature (type, signature) {
        this._rpc({
            route: '/sign/update_user_signature/',
            params: {
                sign_request_id: this.getParent().requestID,
                role: this.role,
                signature_type: type === 'signature' ? 'sign_signature' : 'sign_initials',
                datas: signature
            }
        })
    },

    /**
     * Adjusts signature/initial size to fill the dimensions of the sign item box
     * @param { String } data base64 image
     * @param { jQuery } signatureItem 
     * @returns { Promise }
     */
    adjustSignatureSize: function (data, signatureItem) {
        return new Promise(function (resolve, reject) {
            const img = new Image()
            , c = document.createElement('canvas');

            c.height = signatureItem.height();
            c.width = signatureItem.width();

            img.onload = function () {
                const ctx = c.getContext("2d");
                const oldShadowColor = ctx.shadowColor;
                ctx.shadowColor = "transparent";
                const ratio = ((img.width / img.height) > (c.width / c.height)) ? c.width / img.width : c.height / img.height;

                ctx.drawImage( 
                    img,
                    (c.width / 2) - (img.width * ratio / 2),
                    (c.height / 2) - (img.height * ratio / 2)
                    , img.width * ratio
                    , img.height * ratio
                );
                ctx.shadowColor = oldShadowColor;
                resolve(c.toDataURL())
            };
            img.src = data;
        })
    },

    checkSignItemsCompletion: function() {
        this.refreshSignItems();
        const $toComplete = this.$('.o_sign_sign_item.o_sign_sign_item_required:not(.o_sign_sign_item_pdfview)').filter(function(i, el) {
            let $elem = $(el);
            /* in edit mode, the text sign item has a different html structure due to the form and resize/close icons
            for this reason, we need to check the input field inside the element to check if it has a value */
            $elem = $elem.data('isEditMode') && $elem.attr('type') === 'text' ? $elem.find('input') : $elem;
            const unchecked_box = $elem.val() == 'on' && !$elem.is(":checked");
            return !(($elem.val() && $elem.val().trim()) || $elem.data('signature')) || unchecked_box;
        });

        this.signatureItemNav.$el.add(this.signatureItemNav.$signatureItemNavLine).toggle($toComplete.length > 0);
        this.$iframe.trigger(($toComplete.length > 0)? 'pdfToComplete' : 'pdfCompleted');

        return $toComplete;
    },
});

const InputBottomSheet = Widget.extend({
    events: {
        'blur .o_sign_item_bottom_sheet_field': '_onBlurField',
        'keyup .o_sign_item_bottom_sheet_field': '_onKeyUpField',
        'click .o_sign_next_button': '_onClickNext',
    },
    template: 'sign.item_bottom_sheet',

    init(parent, options) {
        this._super(...arguments);

        this.type = options.type || 'text';
        this.placeholder = options.placeholder || '';
        this.label = options.label || this.placeholder;
        this.value = options.value || '';
        this.buttonText = options.buttonText || _t('next');
        this.onTextChange = options.onTextChange || function () {};
        this.onValidate = options.onValidate || function () {};
    },

    updateInputText(text) {
        this.value = text;
        this.el.querySelector('.o_sign_item_bottom_sheet_field').value = text;
        this._toggleButton();
    },

    show() {
        // hide previous bottom sheet
        const bottomSheet = document.querySelector('.o_sign_item_bottom_sheet.show');
        if (bottomSheet) {
            bottomSheet.classList.remove('show');
        }

        this._toggleButton();
        this.el.style.display = 'block';
        setTimeout(() => this.el.classList.add('show'));
        this.el.querySelector('.o_sign_item_bottom_sheet_field').focus();
    },

    hide() {
        this.el.classList.remove('show');
        this.el.addEventListener('transitionend', () => this.el.style.display = 'none', {once: true});
    },

    _toggleButton() {
        const buttonNext = this.el.querySelector('.o_sign_next_button');
        this.value.length ? buttonNext.removeAttribute('disabled') : buttonNext.setAttribute('disabled', 'disabled');
    },

    _updateText() {
        this.value = this.el.querySelector('.o_sign_item_bottom_sheet_field').value;
        this.onTextChange(this.value);
        this._toggleButton();
    },

    _onBlurField() {
        this._updateText();
    },

    _onClickNext() {
        this.onValidate(this.value);
    },

    _onKeyUpField() {
        this._updateText();
    },
});

const SignableDocument = Document.extend({
    events: {
        'pdfToComplete .o_sign_pdf_iframe': function(e) {
            this.$validateBanner.hide().css('opacity', 0);
        },

        'pdfCompleted .o_sign_pdf_iframe': function(e) {
            if (this.name_list && this.name_list.length > 0) {
                const next_name_signatory = this.name_list[0];
                const next_signatory = core.utils.sprintf(_t(`Validate & the next signatory is "%s"`), next_name_signatory);
                this.$validateBanner.find('.o_validate_button').prop('textContent', next_signatory);
            }
            this.$validateBanner.show().animate({'opacity': 1}, 500, () => {
                if (config.device.isMobile) {
                    this.$validateBanner[0].scrollIntoView({behavior: 'smooth', block: 'center', inline: 'center'});
                }
            });
        },

        'click .o_sign_validate_banner button': 'signItemDocument',
        'click .o_sign_sign_document_button': 'signDocument',
    },

    custom_events: { // do_notify is not supported in backend so it is simulated with a bootstrap alert inserted in a frontend-only DOM element
        'notification': function (e) {
            $('<div/>', {html: e.data.message}).addClass('alert alert-success').insertAfter(this.$('.o_sign_request_reference_title'));
        },
    },

    init: function (parent, options) {
        this._super(parent, options);
        if (parent) {
            this.token_list = (parent.token_list || {});
            this.name_list = (parent.name_list || {});
            this.create_uid = parent.create_uid;
            this.state = parent.state;
            this.current_name = parent.current_name;
            this.documentID = parent.documentID;
        }

        if (this.current_name) {
            $('<div class="col-lg-2">')
                .append(
                    $('<div class="o_sign_request_signer text-center text-secondary">')
                        .text(_t('Signing as '))
                        .append('<b>', {text: this.current_name}))
                .appendTo(parent.$('div.container-fluid .col-lg-3').first());
            parent.$('div.container-fluid .col-lg-3').first().removeClass('col-lg-3').addClass('col-lg-5');
            parent.$('div.container-fluid .col-lg-9').first().removeClass('col-lg-9').addClass('col-lg-5');
        }
    },

    get_pdfiframe_class: function () {
        return SignablePDFIframe;
    },

    get_thankyoudialog_class: function () {
        return ThankYouDialog;
    },

    get_nextdirectsigndialog_class: function () {
        return NextDirectSignDialog;
    },
    signItemDocument: function(e) {
        const $btn = this.$('.o_sign_validate_banner button');
        const init_btn_text = $btn.text();
        $btn.prepend('<i class="fa fa-spin fa-circle-o-notch" />');
        $btn.attr('disabled', true);
        let mail = "";
        this.iframeWidget.$('.o_sign_sign_item').each(function(i, el) {
            const value = $(el).val();
            if(value && value.indexOf('@') >= 0) {
                mail = value;
            }
        });

        const signatureValues = this.getSignatureValuesFromConfiguration();
        if (signatureValues.length === 0) {
            this.iframeWidget.checkSignItemsCompletion();
            Dialog.alert(this, _t("Some fields have still to be completed !"), {title: _t("Warning")});
            $btn.removeAttr('disabled', true);
            return;
        }
        const [signature, newSignItems] = signatureValues;
        const callback = (response) => {
            $btn.text(init_btn_text);
            if(!response) {
                this.openErrorDialog(_t("Sorry, an error occured, please try to fill the document again."), window.location.reload);
            }
            if(response === true) {
                $btn.removeAttr('disabled', true);
                this.iframeWidget.disableItems();
                if (this.name_list && this.name_list.length > 0) {
                    (new (this.get_nextdirectsigndialog_class())(this, this.RedirectURL, this.requestID,
                        {'nextSign': this.name_list.length})).open();
                }
                else {
                    this.openThankYouDialog(0);
                }
            }
            if(typeof response === 'object') {
                if (response.sms) {
                    (new SMSSignerDialog(this, this.requestID, this.accessToken, signatureValues,
                        newSignItems, this.signerPhone, this.RedirectURL,
                        {'nextSign': this.name_list.length})).open();
                }
                if (response.credit_error) {
                    this.openErrorDialog( _t("Unable to send the SMS, please contact the sender of the document."), window.location.reload);
                }
                if (response.url) {
                    document.location.pathname = response.url;
                }
            }
        }
        if(this.$('#o_sign_is_public_user').length > 0) {
            (new PublicSignerDialog(this, this.requestID, this.requestToken, this.RedirectURL))
                .open(this.signerName, mail).sent.then(() => this._sign(signature, callback, newSignItems));
        } else {
            this._sign(signature, callback, newSignItems)
        }
    },

    /**
     * Gets the signature values dictionary from the iframeWidget.configuration
     * Gets the added sign items that were added in edit while signing
     * @returns { Array } array with [0] being the signature values and [1] the new sign items added when editing while signing
     */
    getSignatureValuesFromConfiguration() {
        let signatureValues = {};
        let newSignItems = {};
        for(let page in this.iframeWidget.configuration) {
            for(let i = 0 ; i < this.iframeWidget.configuration[page].length ; i++) {
                const $elem = this.iframeWidget.configuration[page][i];
                const resp = parseInt($elem.data('responsible')) || 0;
                if(resp > 0 && resp !== this.iframeWidget.role) {
                    continue;
                }
                let value = ($elem.val() && $elem.val().trim())? $elem.val() : ($elem.find('input').val() || false);
                if($elem.data('signature')) {
                    value = $elem.data('signature');
                }
                if($elem[0].type === 'checkbox') {
                    value = false ;
                    if ($elem[0].checked) {
                        value = 'on';
                    } else {
                        if (!$elem.data('required')) value = 'off';
                    }
                } else if($elem[0].type === 'textarea') {
                    value = this.textareaApplyLineBreak($elem[0]);
                }
                if(!value) {
                    if($elem.data('required')) {
                        return [];
                    }
                    continue;
                }

                signatureValues[parseInt($elem.data('item-id'))] = value;

                if ($elem.data('isEditMode')) {
                    const id = $elem.data('item-id');
                    newSignItems[id] = {
                        'type_id': $elem.data('type'),
                        'required': $elem.data('required'),
                        'name': $elem.data('name') || false,
                        'option_ids': $elem.data('option_ids'),
                        'responsible_id': resp,
                        'page': page,
                        'posX': $elem.data('posx'),
                        'posY': $elem.data('posy'),
                        'width': $elem.data('width'),
                        'height': $elem.data('height'),
                    };
                }
            }
        }

        return [signatureValues,newSignItems]
    },

    signDocument: function (e) {
        if (this.iframeWidget && this.iframeWidget.signatureItems && Object.keys(this.iframeWidget.signatureItems).length > 0) {
            return this.signItemDocument();
        }
        const nameAndSignatureOptions = {
            fontColor: 'DarkBlue',
            defaultName: this.signerName
        };
        const options = {nameAndSignatureOptions: nameAndSignatureOptions};
        const signDialog = new SignatureDialog(this, options, this.requestID, this.accessToken);

        signDialog.open().onConfirm(() => {
            if (!signDialog.validateSignature()) {
                return false;
            }

            const name = signDialog.getName();
            const signature = signDialog.getSignatureImage()[1];

            signDialog.$('.modal-footer .btn-primary').prop('disabled', true);
            signDialog.close();

            const callback = (success) => {
                if(!success) {
                    this.openErrorDialog(_t("Sorry, an error occured, please try to fill the document again."), window.location.reload);
                } else {
                    this.openThankYouDialog(this.name_list.length);
                }
            }

            if (this.$('#o_sign_is_public_user').length > 0) {
                (new PublicSignerDialog(this, this.requestID, this.requestToken, this.RedirectURL,
                    {'nextSign': this.name_list.length})).open(name, "").sent.then(() => this._sign(signature, callback));
            } else {
                this._sign(signature, callback);
            }
        });
    },

    openThankYouDialog(nextSign) {
        (new (this.get_thankyoudialog_class())(this, this.RedirectURL, this.RedirectURLText,
            this.requestID, {nextSign}))
            .open();
    },
    /**
     * Opens an error dialog
     * @param { String } errorMessage translated error message
     * @param {*} confirmCallback callback after confirm
     */
    openErrorDialog(errorMessage, confirmCallback) {
        Dialog.alert(this, errorMessage, {
            title: _t("Error"),
            confirm_callback: confirmCallback,
        });
    },

    _sign: function (signature, callback, newSignItems=false) {
        const route = '/sign/sign/' + this.requestID + '/' + this.accessToken;
        const params = {
            signature: signature,
            new_sign_items: newSignItems
        }
        return session.rpc(route, params).then(callback);
    },

    textareaApplyLineBreak: function (oTextarea) {
        // Removing wrap in order to have scrollWidth > width
        oTextarea.setAttribute('wrap', 'off');

        const strRawValue = oTextarea.value;
        oTextarea.value = "";

        const nEmptyWidth = oTextarea.scrollWidth;
        let nLastWrappingIndex = -1;

        // Computing new lines
        strRawValue.split("").forEach((curChar, i) => {
            oTextarea.value += curChar;

            if (curChar === ' ' || curChar === '-' || curChar === '+') {
                nLastWrappingIndex = i;
            }

            if (oTextarea.scrollWidth > nEmptyWidth) {
                let buffer = '';
                if (nLastWrappingIndex >= 0) {
                    for (let j = nLastWrappingIndex + 1; j < i; j++) {
                        buffer += strRawValue.charAt(j);
                    }
                    nLastWrappingIndex = -1;
                }
                buffer += curChar;
                oTextarea.value = oTextarea.value.substr(0, oTextarea.value.length - buffer.length);
                oTextarea.value += '\n' + buffer;
            }
        });
        oTextarea.setAttribute('wrap', '');
        return oTextarea.value;
    }
});

function initDocumentToSign(parent) {
    return session.is_bound.then(function () {
        // Manually add 'sign' to module list and load the
        // translations.
        const modules = ['sign', 'web'];
        return session.load_translations(modules).then(function () {
            const documentPage = new SignableDocument(parent);
            return documentPage.attachTo($('body')).then(function() {
                // Geolocation
                const askLocation = ($('#o_sign_ask_location_input').length > 0);
                if(askLocation && navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(function(position) {
                        const { latitude, longitude } = position.coords;
                        const coords = {latitude, longitude};
                        ajax.jsonRpc('/sign/save_location/' + documentPage.requestID + '/' + documentPage.accessToken, 'call', coords);
                    });
                }
            });
        });
    });
}

export const document_signing = {
    EncryptedDialog,
    ThankYouDialog,
    initDocumentToSign,
    SignableDocument,
    SignNameAndSignature,
    SMSSignerDialog,
};

export default document_signing;
