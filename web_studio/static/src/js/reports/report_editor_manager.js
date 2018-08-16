odoo.define('web_studio.ReportEditorManager', function (require) {
"use strict";

var Dialog = require('web.Dialog');
var Pager = require('web.Pager');
var utils = require('web.utils');
var core = require('web.core');
var session = require('web.session');

var ReportEditorSidebar = require('web_studio.ReportEditorSidebar');
var ReportEditor = require('web_studio.ReportEditor');
var AbstractEditorManager = require('web_studio.AbstractEditorManager');

var _t = core._t;


var ReportEditorManager = AbstractEditorManager.extend({
    className: AbstractEditorManager.prototype.className + ' o_web_studio_report_editor_manager',
    custom_events: _.extend({}, AbstractEditorManager.prototype.custom_events, {
        hover_editor: '_onHighlightPreview',
        drop_component: '_onDropComponent',
        begin_drag_component: '_onBeginDragComponent',
        print_report: '_onPrintReport',
        element_removed: '_onElementRemoved',
        iframe_ready: '_onIframeReady',
    }),
    /**
     * @override
     * @param {Object} params
     * @param {Object} params.report
     * @param {Object} params.reportHTML
     * @param {Object} params.reportMainViewID
     * @param {Object} params.reportViews
     * @param {Object} [params.paperFormat]
     */
    init: function (parent, params) {
        this._super.apply(this, arguments);

        this.view_id = params.reportMainViewID;
        this.report = params.report;
        this.reportHTML = params.reportHTML;
        this.reportName = this.report.report_name;
        this.reportViews = params.reportViews;

        this.paperFormat = params.paperFormat;

        this.editorIframeDef = $.Deferred();
    },
    /**
     * @override
     */
    willStart: function () {
        var self = this;

        // load the widgets options for t-options directive
        var defWidgets = this._rpc({
            route: '/web_studio/get_widgets_available_options',
        }).then(function (widgets) {
            self.widgets = widgets;
        });

        var defModels = this._rpc({
            model: 'ir.model',
            method: 'search_read',
            fields: ['id', 'name', 'model'],
            domain: [['transient', '=', false], ['abstract', '=', false]]
        }).then(function (models) {
            self.models = _.object(_.pluck(models, 'model'), _.pluck(models, 'name'));
        });
        var defParent = this._super.apply(this, arguments);
        return $.when(defWidgets, defModels, defParent);
    },
    /**
     * @override
     */
    start: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            self.renderPager();
            self._setPaperFormat();
        });
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------
    /**
     * @override
     */
    renderPager: function () {
        var self = this;
        this.pager = new Pager(this, this.env.ids.length, 1, 1);
        this.pager.on('pager_changed', this, function (newState) {
            this._cleanOperationsStack();
            this.env.currentId = this.env.ids[newState.current_min - 1];
            // TODO: maybe we should trigger_up and the action should handle
            // this? But the pager will be reinstantiate and useless RPCs will
            // be done (see willStart)
            // OR should we put _getReportViews of report_editor_action here?
            // But then it should be mocked in tests?
            this._getReportViews().then(function (result) {
                self.reportHTML = result.report_html;
                self.reportViews = result.views;
                self.updateEditor();
            });
        });
        var $pager = $('<div>', {
            class: 'o_web_studio_report_pager',
        });
        this.pager.appendTo($pager).then(function () {
            self.pager.enable();
        });

        if (self.pager.state.size > 1) {
            $pager.appendTo(this.$el);
        }
    },
    /**
     * @override
     */
    updateEditor: function () {
        var nodesArchs = this._computeView(this.reportViews);
        return this.view.update(nodesArchs, this.reportHTML);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _applyChangeHandling: function (result, from_xml) {
        var self = this;
        // TODO: what should we do with result? Maybe update the studio_view_id
        // if one has been created?
        if (result) {
            if (!result.views) {
                result.views = this.reportViews;
                console.error("no update ????");
            }

            if (!from_xml) {
                // reset studio_arch as it was before the changes for applying
                // the next operations
                _.each(result.views, function (view) {
                    if (view.studio_view_id) {
                        view.studio_arch = self.reportViews[view.view_id].studio_arch;
                    }
                });
            }
            this.reportViews = result.views;
            this.reportHTML = result.report_html;

            return this.updateEditor();
        } else {
            // the operation can't be applied
            this.trigger_up('studio_error', {error: 'wrong_xpath'});
            return this._undo(true).then(function () {
                return $.Deferred().reject();
            });
        }
    },
    /**
     * @private
     * @param {Object} views
     * @returns {Object}
     */
    _computeView: function (views) {
        // TODO: find a better name
        var nodesArchs = _.mapObject(views, function (view, id) {
            var doc = $.parseXML(view.arch).documentElement;
            // first element child because we don't want <template> node
            if (!doc.hasAttribute('t-name')) {
                doc = doc.firstElementChild;
            }
            var node = utils.xml_to_json(doc, true);
            node.id = +id;
            node.key = view.key;
            return node;
        });

        this._setParentKey(nodesArchs);

        return nodesArchs;
    },
    /**
     * @override
     */
    _editView: function (view_id, studio_view_arch, operations) {
        core.bus.trigger('clear_cache');
        return this._rpc({
            route: '/web_studio/edit_report_view',
            params: {
                record_id: this.env.currentId,
                report_name: this.reportName,
                report_views: this.reportViews,
                operations: operations,
                context: session.user_context,
            },
        });
    },
    /**
     * @override
     */
    _editViewArch: function (view_id, view_arch) {
        core.bus.trigger('clear_cache');
        return this._rpc({
            route: '/web_studio/edit_report_view_arch',
            params: {
                record_id: this.env.currentId,
                report_name: this.reportName,
                view_id: view_id,
                view_arch: view_arch,
                context: session.user_context,
            },
        }).done(function (result) {
            if (result.report_html.error) {
                return $.Deferred().reject();
            }
            //self._applyChangeHandling(result);
        });
    },
    /**
     * @private
     * @param {Object} node
     * @returns {Object} first lonely node
     */
    _getNodeToDelete: function (node) {
        var result = node;
        while (
            result.parent &&
            result.parent.children.length === 1 &&  // last child
            result.attrs['data-oe-id'] === result.parent.attrs['data-oe-id'] &&  // same view
            (!result.attrs.class || result.attrs.class.indexOf('page') !== -1)  // cannot delete .page
        ) {
            result = result.parent;
        }
        return result;
    },
    /**
     * @private
     * @returns {Deferred<Object>}
     */
    _getReportViews: function () {
        return this._rpc({
            route: '/web_studio/get_report_views',
            params: {
                record_id: this.env.currentId,
                report_name: this.reportName,
            },
        });
    },
    /**
     * @override
     */
    _instantiateEditor: function () {
        var nodesArchs = this._computeView(this.reportViews);
        this.view = new ReportEditor(this, {
            nodesArchs: nodesArchs,
            paperFormat: this.paperFormat,
            reportHTML: this.reportHTML,
        });
        return $.when(this.view);
    },
    /**
     * @override
     */
    _instantiateSidebar: function (state, previousState) {
        state = _.defaults(state || {}, {
            mode: 'report',
        });
        return new ReportEditorSidebar(this, {
            report: this.report,
            widgets: this.widgets,
            models: this.models,
            state: state,
            previousState: previousState,
        });
    },
    /**
     * @private
     * @param {Object} nodesArchs
     */
    _setParentKey: function (nodesArchs) {
        function setParent(node, parent) {
            if (_.isObject(node)) {
                node.parent = parent;
                _.each(node.children, function (child) {
                    setParent(child, node);
                });
            }
        }
        _.each(nodesArchs, function (node) {
            setParent(node, null);
        });
    },
    /**
     * @private
     */
    _setPaperFormat: function () {
        var format = this.paperFormat || {};

        var $container = this.$('.o_web_studio_report_iframe_container');
        $container.css({
            'padding-bottom': (format.margin_bottom || 0)  + 'px',
            'padding-top': (format.margin_top || 0) + 'px',
            'padding-left': (format.margin_left || 0) + 'px',
            'padding-right': (format.margin_right || 0) + 'px',
            // note: default width/height comes from default A4 size
            'width': (format.print_page_width || 210) + 'mm',
            // avoid a scroll bar with a fixed height
            'min-height': (format.print_page_height || 297) + 'mm',
        });

        this.$('.o_web_studio_report_iframe').css({
            // to remove
            'min-height': (format.print_page_height || 297) + 'mm',
            // 'max-height': document.body.scrollHeight + 'px',
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onBeginDragComponent: function (ev) {
        this.view.beginDragComponent(ev.data.widget);
    },
    /**
     * @override
     */
    _onDragComponent: function (ev) {
        var position = ev.data.position;
        this.view.dragComponent(ev.data.widget, position.pageX, position.pageY);
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onDropComponent: function (ev) {
        this.view.dropComponent(ev.data.widget);
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onElementRemoved: function (ev) {
        var self = this;
        var node = this._getNodeToDelete(ev.data.node);
        var message = _.str.sprintf(_t('Are you sure you want to remove this %s from the view?'), node.tag);

        Dialog.confirm(this, message, {
            confirm_callback: function () {
                self.trigger_up('view_change', {
                    node: node,
                    operation: {
                        type: 'remove',
                        structure: 'remove',
                    },
                });
            },
        });
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onHighlightPreview: function (ev) {
        this.view.highlight(ev.data.node);
    },
    /**
     * @private
     */
    _onIframeReady: function () {
        this.editorIframeDef.resolve();
    },
    /**
     * @override
     */
    _onNodeClicked: function (ev) {
        var node = ev.data.node;

        if (node) {
            var currentNode = node;
            var sidebarNodes = [];
            while (currentNode) {
                sidebarNodes.push({
                    node: currentNode,
                    context: this.view.getNodeContext(currentNode),
                });
                currentNode = currentNode.parent;
            }
            this.sidebar.state = {
                mode: 'properties',
                nodes: sidebarNodes,
            };
        } else {
            this.sidebar.state = {
                mode: 'new',
            };
        }
        // TODO: this should probably not be done like that (setting state on
        // sidebar) but pass paramaters to _updateSidebar instead.
        this._updateSidebar();
    },
    /**
     * @private
     */
    _onPrintReport: function () {
        var self = this;
        this._rpc({
            route: '/web_studio/print_report',
            params: {
                record_id: this.env.currentId,
                report_name: this.reportName,
            },
        }).then(function (action) {
            self.do_action(action);
        });
    },
    /**
     * @override
     * @param {OdooEvent} ev
     * @param {Object} ev.data
     * @param {Object} ev.data.operation the operation sent to the server
     */
    _onViewChange: function (ev) {
        var self = this;
        var def;

        var node = ev.data.node || ev.data.targets[0].node;
        var operation = _.extend(ev.data.operation, {
            view_id: +node.attrs['data-oe-id'],
            xpath: node.attrs['data-oe-xpath'],
            context: node.context,
        });

        if (operation.type === 'add') {
            def = ev.data.component.add({
                targets: ev.data.targets,
            }).then(function (result) {
                // TODO: maybe modify the operation directly?
                _.extend(operation, result);
            });
        } else {
            if (node) {
                this.view.selectedNode = node;
            } else {
                console.warn("the key 'node' should be present");
            }
        }
        $.when(def).then(function () {
            return self._do(operation);
        }).fail(ev.data.fail);
    },
});

return ReportEditorManager;

});
