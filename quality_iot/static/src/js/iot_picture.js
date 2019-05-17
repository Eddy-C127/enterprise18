odoo.define('quality_iot.iot_picture', function (require) {
"use strict";

var registry = require('web.field_registry');
var TabletImage = require('quality.tablet_image_field').TabletImage;
var iot_widgets = require('iot.widgets');
var Dialog = require('web.Dialog');
var core = require('web.core');
var _t = core._t;

var TabletImageIot = TabletImage.extend(iot_widgets.IotValueFieldMixin, {
    events: _.extend({}, TabletImage.prototype.events, {
        'click .o_input_file': '_onButtonClick',
    }),

    /**
     * @private
     */
    _getDeviceInfo: function() {
        if (this.record.data.test_type === 'picture') {
            this.iot_device = new iot_widgets.DeviceProxy({ iot_ip: this.record.data.ip, identifier: this.record.data.identifier });
        }
        return Promise.resolve();
    },

    _onButtonClick: function (ev) {
        var self = this;
        ev.stopImmediatePropagation();
        if (this.iot_device) {
            ev.preventDefault();
            this.do_notify(_t('Capture image...'));
            this.iot_device.action('')
                .then(function(data) {
                    self._onActionSuccess(data);
                })
                .guardedCatch(self._onActionFail);
        }
    },
    /**
     * When the camera change state (after a action that call to take a picture) this function render the picture to the right owner
     *
     * @param {Object} data.owner
     * @param {Object} data.session_id
     * @param {Object} data.message
     * @param {Object} data.image in base64
     */
    _onValueChange: function (data){
        if (data.owner && data.owner === data.session_id) {
            this.do_notify(data.message);
            if (data.image){
                this._setValue(data.image);
            }
        }
    },
    /**
     * After a request to make action on camera and this call don't return true in the result
     * this means that the IoT Box can't connect to camera
     *
     * @param {Object} data.result
     */
    _onActionSuccess: function (data){
        if (!data.result) {
            var $content = $('<p/>').text(_t('Please check if the camera is still connected.'));
            var dialog = new Dialog(this, {
                title: _t('Connection to Camera failed'),
                $content: $content,
            });
            dialog.open();
        }
    },
    /**
     * After a request to make action on camera and this call fail
     * this means that the customer browser can't connect to IoT Box
     */
    _onActionFail: function () {
        var $content = $('<p/>').text(_t('Please check if the IoT Box is still connected.'));
        var dialog = new Dialog(this, {
            title: _t('Connection to IoT Box failed'),
            $content: $content,
        });
        dialog.open();
    },
});

registry.add('iot_picture', TabletImageIot);

return TabletImageIot;
});
