odoo.define('web_studio.ReportEditor', function (require) {
"use strict";

var Widget = require('web.Widget');

var EditorMixin = require('web_studio.EditorMixin');


var ReportEditor = Widget.extend(EditorMixin, {
    template: 'web_studio.ReportEditor',
    nearest_hook_tolerance: 150,

    /**
     * @override
     *
     * @param {Widget} parent
     * @param {Object} params
     * @param {Object} params.nodesArchs
     * @param {String} params.reportHTML
     * @param {Object} [params.paperFormat]
     */
    init: function (parent, params) {
        this._super.apply(this, arguments);

        this.nodesArchs = params.nodesArchs;
        this.reportHTML = params.reportHTML;

        this.paperFormat = params.paperFormat || {};

        this.$content = $();

        this.selectedNode = null;
        this.$targetHighlight = $();

        this.$dropZone = $();
        this._onUpdateContentId = _.uniqueId('_processReportPreviewContent');
    },
    /**
     * @override
     */
    start: function () {
        this.$iframe = this.$('iframe');
        this.$iframe.one('load', this._updateContent.bind(this));
        return this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    destroy: function() {
        window.top[this._onUpdateContentId] = null;
        delete window.top[this._onUpdateContentId];
        if (this.$content) {
            this.$content.off('click');
            this.$content.off('load');
        }
        return this._super.apply(this, arguments);
    },
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Insert Studio hooks in the dom iframe, according to which component is
     * being dragged.
     *
     * @param {Component} component
     */
    beginDragComponent: function (component) {
        var self = this;
        this.$dropZone.remove();
        var dropIn = component.dropIn;
        if (component.dropColumns) {
            dropIn = (dropIn ? dropIn + ',' : '') + '.page > .row > div:empty';
        }
        if (dropIn) {
            var inSelectors = dropIn.split(',');
            _.each(inSelectors, function (selector) {
                var $target = self.$content.find(selector + "[data-oe-xpath]");
                if (!$target.data('node')) {
                    // this is probably a template not present in reportViews
                    // TODO: should the corresponding view be branded
                    // (server-side) in this case?
                    return;
                }
                _.each($target, function (node) {
                    self._createHookOnNodeAndChildren($(node), component);
                });
            });
        }
        if (component.dropColumns) {
            // when dropping the component, it should have a specific (bootstrap) column structure
            // we will create this structure or complete it if it already exist
            var $hook = self._createHook($('<div/>'), component);
            var $gridHooks = $('<div class="row o_web_studio_structure_hook o_web_studio_nearest"/>');
            _.each(component.dropColumns, function (column, index) {
                var $col = $('<div class="offset-' + column[0] + ' col-' + column[1] + '"/>');
                $col.append($hook.clone().attr('data-oe-index', index));
                $gridHooks.append($col);
            });

            var $page = this.$content.find('.page');
            var $children = $page.children().not('.o_web_studio_hook');

            if ($children.length) {
                $gridHooks.find('.o_web_studio_hook').data('oe-node', $children.first()).data('oe-position', 'before');
                $children.first().before($gridHooks);

                _.each($children, function (child) {
                    var $child = $(child);
                    var $newHook = $gridHooks.clone();
                    $newHook.find('.o_web_studio_hook').data('oe-node', $child).data('oe-position', 'after');
                    $child.after($newHook);
                });
            } else {
                $gridHooks.find('.o_web_studio_hook').data('oe-node', $page).data('oe-position', 'inside');
                $page.prepend($gridHooks);
            }

            this.$content.find('.o_web_studio_structure_hook + .o_web_studio_hook').remove();
            this.$content.find('.o_web_studio_structure_hook').prev('.o_web_studio_hook').remove();
        }
        this.$content.find('.o_web_studio_hook + .o_web_studio_hook').remove();
        this.$dropZone = this.$content.find('.o_web_studio_hook');

        this.$dropZoneStructure = this.$content.find('.o_web_studio_structure_hook');
        this.$dropZoneStructure.removeClass('.o_web_studio_nearest').each(function () {
            $(this).children().children('.o_web_studio_hook:only-child').data('height', $(this).height() + 'px');
        });

        // compute the size box with the nearest rendering
        self._computeNearestHookAndShowIt();

        // association for td and colspan
        this.$dropZone.filter('th, td').each(function (_, item) {
            var $item = $(item);
            var $node = $item.data('oe-node');
            var colspan = +$node.data('colspan');
            if (colspan > 1) {
                $node.attr('colspan', colspan*2-1);
            }
        });
    },
    /**
     * When a component is being dragged in the iframe, this function computes
     * which Studio hook(s) are the nearest.
     *
     * @param {Component} component
     * @param {integer} x
     * @param {integer} y
     */
    dragComponent: function (component, x, y) {
        this.$dropZone
            .filter('.o_web_studio_nearest_hook')
            .removeClass('o_web_studio_nearest_hook')
            .css('height', '')
            .closest(this.$dropZoneStructure).each(function () {
                $(this).children().css('height', '').children('.o_web_studio_hook:only-child').css('height', '');
            });

        this.$dropZoneStructure.removeClass('o_web_studio_nearest');

        var bound = this.$iframe[0].getBoundingClientRect();
        var isInIframe = (x >= bound.left  && x <= bound.right) && (y >= bound.top && y <= bound.bottom);
        if (!isInIframe) {
            return;
        }

        // target with position of the box center
        _.each(this.dropPosition, function (box) {
            box.dist = Math.sqrt(Math.pow(box.centerY - (y - bound.top), 2) + Math.pow(box.centerX - (x - bound.left), 2));
        });
        this.dropPosition.sort(function (a, b) {
            return a.dist - b.dist;
        });

        if (!this.dropPosition[0] || this.dropPosition[0].dist > this.nearest_hook_tolerance) {
            return;
        }

        var $nearestHook = $(this.dropPosition[0].el);

        $nearestHook
            .addClass('o_web_studio_nearest_hook')
            .closest(this.$dropZoneStructure)
            .addClass('o_web_studio_nearest')
            .each(function () {
                var height = $(this).height() + 'px';
                $(this).children().css('height', height).children('.o_web_studio_hook:only-child').css('height', height);
            });

        if (component.hookAutoHeight) {
            $nearestHook.css('height', $nearestHook.data('height') || '');
        }

        if (!$nearestHook.data('oe-node') || !$nearestHook.data('oe-node').data('oe-id')) {
            return;
        }

        var $node = $nearestHook.data('oe-node');
        var id = $node.data('oe-id');
        var xpath = $node.data('oe-xpath');
        var position = $nearestHook.data('oe-position');
        var index = $nearestHook.data('oe-index');

        var td = $node.is('td, th');
        var reg, replace;
        if (td) {
            reg = /^(.*?)\/(thead|tbody|tfoot)(.*?)\/(td|th)(\[[0-9]+\])?/;
            replace = td && position === 'inside' ? '$1/$2/tr/td' : '$1/tr/td';
            xpath = xpath.replace(reg, replace);
        }

        // select all dropzone with the same xpath
        var $nearestHooks = this.$dropZone.filter(function () {
            var $hook = $(this);
            var $node = $hook.data('oe-node');
            return $hook.data('oe-position') === position &&
                $hook.data('oe-index') === index &&
                $node.data('oe-id') === id &&
                (td ? $node.data('oe-xpath').replace(reg, replace) : $node.data('oe-xpath')) === xpath;
        });

        if (td) {
            var pos = $nearestHook.data('oe-node').data('td-position-' + (position === 'before' ? 'before' : 'after'));
            $nearestHooks = $nearestHooks.filter(function () {
                var $node = $(this).data('oe-node');
                return $node.data('td-position-' + (position === 'before' ? 'before' : 'after')) === pos;
            });
        }

        $nearestHooks.addClass('o_web_studio_nearest_hook');

        if (component.hookAutoHeight) {
            $nearestHooks.css('height', $nearestHook.data('height') || '');
        }
    },
    /**
     * When a component has been dropped in the iframe, we genrate the changes
     * in the view and clean the hooks.
     *
     * @param {Component} component
     */
    dropComponent: function (component) {
        var self = this;
        var clean = function () {
            self.$dropZone.filter('th, td').each(function () {
                var $node = $(this).data('oe-node');
                var colspan = $node.data('colspan');
                if (colspan) {
                    $node.attr('colspan', colspan);
                }
            });
            self.$content.find('.o_web_studio_hook').remove();
            self.$content.find('.o_web_studio_structure_hook').remove();
        };

        var $dropZone = this.$dropZone.filter('.o_web_studio_nearest_hook');
        var targets = $dropZone.map(function () {
            var $active = $(this);
            return {
                node: $active.data('oe-node').data('node'),
                position: $active.data('oe-position'),
                data: $active.data(),
            };
        }).get();

        if (targets.length) {
            this.trigger_up('view_change', {
                component: component,
                fail: clean,
                targets: targets,
                operation: {
                    type: 'add',
                    position: $dropZone.first().data('oe-position'),
                },
            });
        } else {
            clean();
        }
    },
    /**
     * Get the context associated to a node.
     *
     * @param {Object} initialNode
     * @returns {Object}
     */
    getNodeContext: function (initialNode) {
        var node = initialNode;
        var $nodes = this._findAssociatedDOMNodes(node);
        while (!$nodes.length && node.parent) {
            var index = node.parent.children.indexOf(node);
            for (index; index > 0; index--) {
                $nodes = this._findAssociatedDOMNodes(node.parent.children[index]);
                if ($nodes.length) {
                    break;
                }
            }
            if (!$nodes.length) {
                node = node.parent;
            }
        }
        if (!$nodes.length) {
            $nodes = this.$content.find('*[data-oe-xpath]');
        }

        return $nodes.data('oe-context');
    },
    /**
     * Highlight (shows a red arrow on) a DOM node.
     *
     * @param {Object} node
     */
    highlight: function (node) {
        if (!this.$highlight) {
            // an arrow that helps understanding which DOM element is being edited
            this.$highlight = $('<span class="o_web_studio_report_highlight"/>');
            this.$content.find('body').prepend(this.$highlight);
        }

        if (this.$targetHighlight.data('node') !== this.selectedNode) {
            // do not remove the highlight on the clicked node
            this.$targetHighlight.removeClass('o_web_studio_report_selected');
        }

        var $nodes = this._findAssociatedDOMNodes(node);
        if ($nodes && $nodes.length) {
            this.$targetHighlight = $nodes.addClass('o_web_studio_report_selected');
            var position = this.$targetHighlight.offset();
            this.$highlight
                .css({
                    top: position.top + 'px',
                    left: position.left + 'px',
                    bottom: position.top < 50 ? '0':'auto',
                })
                .toggleClass('o_web_studio_report_highlight_left', position.left < 50)
                .toggleClass('o_web_studio_report_highlight_top', position.top < 50)
                .show();
        } else {
            this.$highlight.hide();
        }
    },
    /**
     * @override
     */
    unselectedElements: function () {
        var $nodes = this._findAssociatedDOMNodes(this.selectedNode);
        $nodes.removeClass('o_web_studio_report_selected');
        this.selectedNode = null;
    },
    /**
     * Update the iframe content with a new HTML description.
     *
     * @param {Object} nodesArchs
     * @param {String} reportHTML
     * @returns {Deferred}
     */
    update: function (nodesArchs, reportHTML) {
        var self = this;
        this.nodesArchs = nodesArchs;
        this.reportHTML = reportHTML;

        this._resizeIframe();

        return this._updateContent().then(function () {
            if (self.selectedNode) {
                var $nodes = self._findAssociatedDOMNodes(self.selectedNode);
                if ($nodes.length) {
                    $nodes.first().click();
                } else {
                    self.selectedNode = null;
                }
            }
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------
    /**
     * create hook on target and compute its size
     * @param {JQElem} $node  the node from the dom of the report that should be hooked onto
     * @param {Object} component the component from the sidebar currently being dragged
     */
    _createHookOnNodeAndChildren: function ($node, component) {
        var self = this;
        var $hook = self._createHook($(this), component);
        var $newHook = $hook.clone();
        var $children = $node.children().not('.o_web_studio_hook');
        // display the hook with max height of this sibling
        if ($children.length === 1 && $children.is('td[colspan="99"]')) {
            return;
        }
        if ($children.length) {
            if (!$node.is('tr') && component.hookAutoHeight) {
                var height = Math.max.apply(Math, $children.map(function () {return $(this).height();}));
                $newHook.data('height', height + 'px');
            }
            $newHook.data('oe-node', $children.first()).data('oe-position', 'before');
            $children.first().before($newHook);

            $children.each(
                /* allows to drop besides each children */
                function (_, childNode) {
                var $childNode = $(childNode);
                var $newHook = $hook.clone().data('oe-node', $childNode).data('oe-position', 'after');
                if (!$childNode.is('tr') && component.hookAutoHeight) {
                    $newHook.data('height', height + 'px');
                }
                $childNode.after($newHook);
            });
        } else {
            $newHook.data('oe-node', $node).data('oe-position', 'inside');
            $node.prepend($newHook);
        }
    },
    _computeNearestHookAndShowIt: function () {
        var self = this;
        this.dropPosition = [];
        var dropZone = this.$dropZone.get();
        dropZone.reverse();
        _.each(dropZone, function (node) {
            var $node = $(node);
            $node.addClass('o_web_studio_nearest_hook').css('height', $node.data('height') || '');
            var box = node.getBoundingClientRect();
            box.el = node;
            box.centerY = (box.top + box.bottom) / 2;
            box.centerX = (box.left + box.right) / 2;
            self.dropPosition.push(box);
            $node.removeClass('o_web_studio_nearest_hook').css('height', '');
        });
    },
    /**
     * Recursively parses the DOM of the report and add the `data` and `attributes` on every DOM nodes,
     * according to the qWeb template that generated the report.
     *
     * After this function, every node in the DOM and in memory will have access to their context
     *
     * @private
     */
    _connectNodes: function () {
        var self = this;
        var nodesNotInView = [];

        function connectNodes (node) {
            if (!node.attrs) {
                return;
            }
            var $nodes = self._findAssociatedDOMNodes(node);
            $nodes.data('node', node);
            if ($nodes.length) {
                node.context = $nodes.data('oe-context');
            } else {
                nodesNotInView.push(node);
            }

            _.each(node.attrs, function (value, key) {
                if ($nodes.attr(key) === undefined) {
                    $nodes.attr(key, value);
                }
            });
            _.each(node.children, connectNodes);
        }
        _.each(this.nodesArchs, connectNodes);


        function connectContextOrder (dom, contextOrder) {
            var $node = $(dom);
            var newOrder = contextOrder.slice();
            var node = $node.data('node');

            if (node) {
                if (node.contextOrder) {
                    return node.contextOrder;
                }
                newOrder = node.contextOrder = _.uniq(contextOrder.concat(_.keys(node.context)));
            }

            var children = $node.children().get();
            for (var k = 0; k < children.length; k++) {
                newOrder = connectContextOrder(children[k], newOrder);
            }
            return newOrder;
        }

        var children = this.$content.children().get();
        for (var k = 0; k < children.length; k++) {
            connectContextOrder(children[k], []);
        }

        var bodyContext = this.$content.find('html').data('oe-context');
        _.each(nodesNotInView, function (node) {
            node.context = node.parent && node.parent.context || bodyContext;
        });
    },
    /**
     * @private
     * @param {jQuery} $target
     * @param {Component} component
     * @returns {jQuery}
     */
    _createHook: function ($target, component) {
        var firstChild = $target.children().get(0);
        var hookTag = ((firstChild && firstChild.tagName) || 'div').toLocaleLowerCase();
        if (!$target.is('tr') && component.hookTag) {
            hookTag = component.hookTag;
        }
        if (hookTag === 'table') {
            hookTag = 'div';
        }
        var $hook = $('<' + hookTag + ' class="o_web_studio_hook"/>');
        if ($target.hasClass('row')) {
            $hook.addClass('col-3');
        }
        if (component.hookClass) {
            $hook.addClass(component.hookClass);
        }
        return $hook;
    },
    /**
     * finds all the DOM nodes that share the same context as the node in parameter.
     * Example, all the cells of the same column are sharing the same context: they come from the same report template.
     *
     * @private
     * @param {Object} node qWeb node
     * @returns {jQuery} associated DOM nodes
     */
    _findAssociatedDOMNodes: function (node) {
        if (node) {
            return this.$content.find('[data-oe-id="' + node.attrs['data-oe-id'] + '"][data-oe-xpath="' + node.attrs['data-oe-xpath'] + '"]');
        } else {
            return $();
        }
    },
    /**
     * takes the content of the report preview (in the iframe) to
     * - adds all the node meta-data
     * - ensure its size is correct
     * - add meta-data about colspan to make the drag&drop easier
     * @private
     */
    _processReportPreviewContent: function () {
        this.$content = this.$('iframe').contents();
        this.$content.off('click').on('click', this._onMouseClick.bind(this));
        this._connectNodes();
        this.$('.o_web_studio_loader').hide();
        this._resizeIframe();

        // association for td and colspan

        this.$content.find('tr').each(function () {
            var $tr = $(this);
            var $tds = $tr.children();
            var lineMax = 0;
            $tds.each(function () {
                var $td = $(this);
                var colspan = +$td.attr('colspan');
                $td.data('colspan', colspan || 1);
                $td.data('td-position-before', lineMax);
                lineMax += colspan || 1;
                $td.data('td-position-after', lineMax);
            });
        });
    },
    /**
     * @private
     */
    _resizeIframe: function () {
        var self = this;
        // WHY --> so that after the load of the iframe, if there are images,
        // the iframe height is recomputed to the height of the content images included
        self.$iframe[0].style.height = self.$iframe[0].contentWindow.document.body.scrollHeight + 'px';

        this.$content.find('.header').css({
            'margin-bottom': (this.paperFormat.header_spacing || 0) + 'mm',
        });
        // TODO: won't be pretty if the content is larger than the format
        this.$content.find('.footer').css({
            'position': 'fixed',
            'bottom': '0',
        });

        this.$content.find('html')[0].style.overflow = 'hidden';

        // set the size of the iframe
        $(this.$content).find("img").load(function() {
            self.$iframe[0].style.height = self.$iframe[0].contentWindow.document.body.scrollHeight + 'px';
        });
    },
    /**
     * Update the iframe content.
     *
     * @private
     * @returns {Deferred}
     */
    _updateContent: function () {
        var self = this;
        this.$content = this.$iframe.contents();
        var reportHTML = this.reportHTML;

        if (reportHTML.error) {
            var stack = reportHTML.stack
                 .replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#039;");
            reportHTML = '<h1>' + reportHTML.error + '</h1><pre>' + stack + '</pre>';
            this.$content.find('body').html(reportHTML);
            this._processReportPreviewContent();
            return $.when();
        }

        var $main = this.$content.find('main:first');
        if ($main.length) {
            $main.replaceWith($(reportHTML).find('main:first'));
            this._processReportPreviewContent();
            return $.when();
        }

        var def = $.Deferred();
        window.top[this._onUpdateContentId] = function () {
            if (!self.$('iframe')[0].contentWindow) {
                return def.reject();
            }
            self._processReportPreviewContent();
            self.trigger_up('iframe_ready');
            def.resolve();
        };
        // determine when the body has been inserted
        reportHTML = reportHTML.replace(
            '</body>',
            '<script>window.top.' + this._onUpdateContentId + '()</script></body>'
        );

        // inject HTML
        var cwindow = this.$iframe[0].contentWindow;
        cwindow.document
            .open("text/html", "replace")
            .write(reportHTML);

        return def;
    },
    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------
    /**
     * @private
     * @param {Event} e
     */
    _onMouseClick: function (e) {
        e.preventDefault();
        e.stopPropagation();

        var $node = $(e.target).closest('[data-oe-xpath]');
        if ($node.closest('[t-field], [t-esc]').length) {
            $node = $node.closest('[t-field], [t-esc]');
        }
        var node = $node.data('node');

        if (this.selectedNode) {
            if (this.selectedNode === node) {
                return;
            }
            var $oldSelectedNodes = this._findAssociatedDOMNodes(this.selectedNode);
            $oldSelectedNodes.removeClass('o_web_studio_report_selected');
        }

        this.selectedNode = node;
        var $nodesToHighlight = this._findAssociatedDOMNodes(this.selectedNode);
        $nodesToHighlight.addClass('o_web_studio_report_selected');
        this.trigger_up('node_clicked', {
            node: this.selectedNode,
        });
    },
});

return ReportEditor;

});
