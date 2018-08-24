odoo.define('account_online_sync.acc_config_widget', function(require) {
"use strict";

var core = require('web.core');
var framework = require('web.framework');
var AbstractAction = require('web.AbstractAction');
var QWeb = core.qweb;

var OnlineSyncAccountInstitutionSelector = AbstractAction.extend({
    template: 'OnlineSyncSearchBank',
    init: function(parent, context) {
        this._super(parent, context);
        this.search_allowed = true;
        this.starred_inst = context.starred_inst;
        this.sync_error_message = context.sync_error_message;
        this.results = this.starred_inst; // First shown results are the starred institutions
        if (context.context !== undefined) {
            this.context = context.context;
            this.country = context.context.country;
        }
        this.state = (this.sync_error_message !== '') ? 'error' : 'dashboard';
    },

    start: function() {
        this.displayState();
    },

    displayState: function() {
        var self = this;
        if (this.state === 'error') {
            self.$('.sync_error').removeClass('hidden');
            self.renderSyncError();
        }
        else if (this.state === 'search' || (this.state === 'dashboard' && this.results.length > 0)) {
            self.$('.institutions_search').removeClass('hidden');
            self.$('.favorite_institutions_no_result').addClass('hidden');
            if (self.results.length > 0) {
                // Display results
                self.$('.institution_no_result').addClass('hidden');
                self.$('.institution_result').removeClass('hidden');
                self.renderSearchResult();
            }
            else {
                // Show no results
                self.$('.institution_no_result').removeClass('hidden');
                self.$('.institution_result').addClass('hidden');
            }
        }
        else {
            self.$('.favorite_institutions_no_result').removeClass('hidden');
            self.$('.institutions_search').addClass('hidden');
        }
    },

    openInstitution: function($node) {
        var self = this;
        if (self.willDisappear === true) {
            return true;
        }
        self.willDisappear = true;
        var provider = $node.data('provider');
        var instId = $node.data('instId');
        var beta = $node.data('beta') || false;
        self._rpc({
            model: 'account.online.provider',
            method: 'get_login_form',
            args: [[], instId, provider, beta, self.context],
        })
        .then(function(result) {
            self.do_action(result);
        });
    },

    renderButtons: function($node) {
        var self = this;
        this.$buttons = $(QWeb.render("OnlineSyncSearchBankFooter", {'widget': this}));
        this.$buttons.find('.js_cancel').click(function(e) {
            self.do_action({type: 'ir.actions.act_window_close'});
        });
        this.$buttons.find('.js_select_institution').click(function(e) {
            // Find element selected and open it
            if (self.selected) {
                self.openInstitution(self.$('.js_institution[data-inst-id='+self.selected+']'));
            }
        });
        this.$buttons.find('.js_configure_manually').click(function(){
            return self.configure_manually()
        });
        this.$('.institution_no_result').find('.js_configure_manually').click(function(){
            return self.configure_manually()
        });
        this.$buttons.appendTo($node);
    },

    configure_manually: function(){
        var self = this;
        return self._rpc({
            model: 'account.online.provider',
            method: 'get_manual_configuration_form',
            args: [self.context]
        })
        .then(function(action) {
            self.do_action(action, {
                  on_close: function () {
                      core.bus.trigger("refresh_account_dashboard");
                  },
            });
        });
    },

    renderElement: function() {
        var self = this;
        this._super();
        this.$('#search_form').submit(function(event){
            event.preventDefault();
            event.stopPropagation();
            self.searchInstitution();
        });
        this.$('#click_search_institution').click(function(){
            self.searchInstitution();
        });
        this.$('#search_institution').blur(function() {
            if (self.state !== 'dashboard' && self.$('#search_institution').val() === '') {
                self.state = 'dashboard';
                self.displayState();
            }
        });
        this.$('.o_institution').click(function (e) {
            self.openInstitution($(this));
        });
        this.$('.switch_country').click(function (e) {
            if ($(e.target).attr('value') !== self.country) {
                self.switchCountry();
            }
        });
    },

    renderSyncError: function() {
        var self = this
        self.$('.sync_error').html('');
        var $errorMessage = $(QWeb.render('OnlineSyncErrorMessage', {sync_error_message: self.sync_error_message}));
        $errorMessage.find('.js_configure_manually').click(function(){
            return self.configure_manually()
        });
        $errorMessage.appendTo(self.$('.sync_error'));
    },

    renderSearchResult: function() {
        var self = this;
        self.$('.institution_result').html('');
        var $searchResults = $(QWeb.render('OnlineSyncSearchBankTable', {institutions: self.results}));

        // Bind elements
        $searchResults.find('.js_institution').click(function (e) {
            var instId = $(e.target).data('instId') || $(e.target).parents('.js_institution').data('instId');
            if (self.selected === instId) {
                // fold and deselect
                self.selected = false;
                self.$('.js_institution[data-inst-id='+instId+']').removeClass('selected');
                self.$buttons.find('.js_select_institution').prop('disabled', true);
                self.$buttons.find('.js_select_institution').toggleClass('btn-primary btn-default');
            }
            else {
                self.selected = instId;
                self.$buttons.find('.js_select_institution').prop('disabled', false);
                self.$('.js_institution').removeClass('selected');
                self.$('.js_institution[data-inst-id='+instId+']').addClass('selected');
                self.$buttons.find('.js_select_institution').removeClass('btn-default');
                self.$buttons.find('.js_select_institution').addClass('btn-primary');
            }
            self.$('.js_institution_detail:not(.hidden):not(#'+instId+')').addClass('hidden');
            self.$('#'+instId+'').toggleClass('hidden');
        });
        // Append to view
        $searchResults.appendTo(self.$('.institution_result'));
    },

    searchInstitution: function() {
        var self = this;
        if (self.$('#search_institution').val() === '') {
            self.state = 'dashboard';
            self.displayState();
            return true;
        }
        if (self.search_allowed === true) {
            //search_allowed is used to prevent doing multiple RPC call during the search time
            self.search_allowed = false;
            self.selected = false;
            self.state = 'search';
            self.$buttons.find('.js_select_institution').prop('disabled', true);
            framework.blockUI();

            return this._rpc({
                    model: 'account.online.provider',
                    method: 'get_institutions',
                    args: [[], self.$('#search_institution').val(), self.country === 'worldwide' ? false : self.country],
                })
                .then(function(result){
                    framework.unblockUI();
                    var results = JSON.parse(result);
                    self.results = results.match || [];
                    self.displayState();
                    self.search_allowed = true;
                }).fail(function(){
                    framework.unblockUI();
                    // If RPC call failed (might be due to error because search string is less than 3 char), unblock search
                    self.search_allowed = true;
                    self.$buttons.find('.js_select_institution').prop('disabled', false);
                });
        }
    },

    switchCountry: function () {
        if (this.country === 'worldwide') {
            this.country = this.context.country;
        }
        else {
            this.country = 'worldwide';
        }
        this.displayState();
        // If there is a value in searchbox, perform search with new country
        if (this.$('#search_institution').val().length > 0) {
            this.searchInstitution();
        }
    },

});
core.action_registry.add('online_sync_institution_selector', OnlineSyncAccountInstitutionSelector);
});