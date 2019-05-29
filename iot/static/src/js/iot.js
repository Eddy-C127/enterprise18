odoo.define('iot.widgets', function (require) {
'use strict';

var core = require('web.core');
var Widget = require('web.Widget');
var field_registry = require('web.field_registry');
var widget_registry = require('web.widget_registry');
var Dialog = require('web.Dialog');
var ActionManager = require('web.ActionManager');
var basic_fields = require('web.basic_fields');
var BusService = require('bus.BusService');

var _t = core._t;

ActionManager.include({
    _executeReportAction: function (action) {
        if (action.device_id) {
            // Call new route that sends you report to send to printer
            var self = this;
            self.action = action;
            return this._rpc({
                model: 'ir.actions.report',
                method: 'iot_render',
                args: [action.id, action.context.active_ids, {'device_id': action.device_id}]
            }).then(function (result) {
                var iot_device = new DeviceProxy({ iot_ip: result[0], identifier: result[1] });
                iot_device.action({'document': result[2]})
                    .then(function(data) {
                        self._onActionSuccess.call(self, data);
                    }).guardedCatch(self._onActionFail.bind(self));
            });
        }
        else {
            return this._super.apply(this, arguments);
        }
    },

    _onActionSuccess: function (data){
        if (data.result) {
            this.do_notify(_t('Successfully sent to printer!'));
        } else {
            this.do_warn(_t('Connection to Printer failed'), _t('Please check if the printer is still connected.'));
        }
    },

    _onActionFail: function (data){
        var $content = $('<p/>').text(_t('Please check if the IoT Box is still connected.'));
        var dialog = new Dialog(this, {
            title: _t('Connection to IoT Box failed'),
            $content: $content,
        });
        dialog.open();
    },
});

var IotScanButton = Widget.extend({
    tagName: 'button',
    className: 'o_iot_detect_button btn btn-primary',
    events: {
        'click': '_onButtonClick',
    },
    init: function (parent, record) {
        this._super.apply(this, arguments);
        this.token = record.data.token;
        this.parseURL = new URL(window.location.href);
        this.controlImage = '/iot.jpg';
        this.box_connect = '/hw_drivers/box/connect?token=' + btoa(this.token);
    },

    start: function () {
        this._super.apply(this, arguments);
        this.$el.text(_t('SCAN'));
    },

    _getUserIP: function (onNewIP) {
        //  onNewIp - your listener function for new IPs
        //compatibility for firefox and chrome
        var MyPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
        var pc = new MyPeerConnection({
            iceServers: []
        });
        var noop = function () {};
        var localIPs = {};
        var ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/g;

        function iterateIP(ip) {
            if (!localIPs[ip]){
                if (ip.length < 16){
                    localIPs[ip] = true;
                    onNewIP(ip);
                }
            }
        }

        //create a bogus data channel
        pc.createDataChannel('');

        // create offer and set local description
        pc.createOffer().then(function (sdp) {
            sdp.sdp.split('\n').forEach(function (line) {
                if (line.indexOf('candidate') < 0) return;
                line.match(ipRegex).forEach(iterateIP);
            });

            pc.setLocalDescription(sdp, noop, noop);
        });

        //listen for candidate events
        pc.onicecandidate = function (ice) {
            if (!ice || !ice.candidate || !ice.candidate.candidate || !ice.candidate.candidate.match(ipRegex)) return;
            ice.candidate.candidate.match(ipRegex).forEach(iterateIP);
        };
    },

    _scanRange: function (urls, range) { 
        var self = this;
        var img = new Image();
        var url = urls.shift();
        if (url){
            var promise = new Promise(function (resolve, reject) {
                $.ajax({
                    url: url + '/hw_proxy/hello',
                    method: 'GET',
                    timeout: 400,
                }).then(function () {
                    self._addIOT(url);
                    self._connectToIOT(url);
                    self._scanRange(urls, range);
                    self._updateRangeProgress(range);
                    resolve();
                }).fail(reject);
            });
            promise.guardedCatch(function (jqXHR, textStatus) {
                // * If the request to /hw_proxy/hello returns an error while we contacted it in https,
                // * it could mean the server certificate is not yet accepted by the client.
                // * To know if it is really the case, we try to fetch an image on the http port of the server.
                // * If it loads successfully, we put informations of connection in parameter of image.
                if (textStatus === 'error' && self.parseURL.protocol === 'https:') {
                    var imgSrc = url + self.controlImage;
                    img.src = imgSrc.replace('https://', 'http://');
                    img.onload = function(XHR) {
                        self._addIOT(url);
                        self._connectToIOT(url);
                    };
                }
                self._scanRange(urls, range);
                self._updateRangeProgress(range);
            });
        }
    },

    _addIPRange: function (range){
        var ipPerRange = 256;

        var $range = $('<li/>').addClass('list-group-item').append('<b>' + range + '*' + '</b>');
        var $progress = $('<div class="progress"/>');
        var $bar = $('<div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"/>').css('width', '0%').text('0%');

        $progress.append($bar);
        $range.append($progress);

        this.ranges[range] = {
            $range: $range,
            $bar: $bar,
            urls: [],
            current: 0,
            total: ipPerRange,
        };
        this.$progressRanges.append($range);

        for (var i = 0; i < ipPerRange; i++) {
            var port = '';
            if (this.parseURL.protocol === 'http:') {
                port = ':8069';
            }
            this.ranges[range].urls.push(this.parseURL.protocol + '//' + (range + i) + port);
        }
    },

    _processIRRange: function (range){
        for (var i = 0; i < 6; i++) {
            this._scanRange(range.urls, range);
        }
    },

    _updateRangeProgress: function (range) {
        range.current ++;
        var percent = Math.round(range.current / range.total * 100);
        range.$bar.css('width', percent + '%').attr('aria-valuenow', percent).text(percent + '%');
    },

    _findIOTs: function (options) {
        options = options || {};
        var self = this;
        var range;

        this._getUserIP(function (ip) {
            self._initProgress();

            if (ip) {
                range = ip.substring(0, ip.lastIndexOf('.') + 1);
                self._addIPRange(range);
            }
            else {
                self._addIPRange('192.168.0.');
                self._addIPRange('192.168.1.');
                self._addIPRange('10.0.0.');
            }

            _.each(self.ranges, self._processIRRange, self);
        });
    },

    _initProgress: function (){
        this.$progressBlock = $('.scan_progress').show();
        this.$progressRanges = this.$progressBlock.find('.scan_ranges').empty();
        this.$progressFound = this.$progressBlock.find('.found_devices').empty();

        this.ranges = {};
        this.iots = {};
    },

    _addIOT: function (url){
        var $iot = $('<li/>')
            .addClass('list-group-item')
            .appendTo(this.$progressFound);

        $('<a/>')
            .attr('href', url)
            .attr('target', '_blank')
            .text(url)
            .appendTo($iot);

        $iot.append('<i class="iot-scan-status-icon"/>')
            .append('<div class="iot-scan-status-msg"/>');

        this.iots[url] = $iot;
        this.$progressFound.append($iot);
    },

    _updateIOT: function (url, status, message){
        if (this.iots[url]) {
            var $iot = this.iots[url];
            var $icon = $iot.find('.iot-scan-status-icon');
            var $msg = $iot.find('.iot-scan-status-msg');

            var icon = 'fa pull-right iot-scan-status-icon mt-1 ';
            switch (status) {
                case "loading":
                    icon += 'fa-spinner fa-spin';
                    break;
                case "success":
                    icon += "fa-check text-success";
                    break;
                default:
                    icon += "fa-exclamation-triangle text-danger";
            }
            $icon.removeClass().addClass(icon);
            $msg.empty().append(message);
        }
    },

    _connectToIOT: function (url){
        var img = new Image();
        var self = this;
        img.src = url.replace('https://', 'http://') + self.box_connect;
        img.onload = function(jqXHR) {
            if (img.height === 10){
                self._updateIOT(url, 'success', _t('IoTBox connected'));
            } else {
                self._updateIOT(url, 'error', _t('This IoTBox has already connected'));
            }
        };
        img.onerror = function(jqXHR) {
            self._updateIOT(url, 'error', _t('Connection failed'));
        };
    },

    _onButtonClick: function (e) {
        this.$el.attr('disabled', true);
        this._findIOTs();
    },
});

widget_registry.add('iot_detect_button', IotScanButton);

var IoTLongpolling = BusService.extend({
    // constants
    POLL_TIMEOUT: 60000,
    POLL_ROUTE: '/hw_drivers/event',
    ACTION_TIMEOUT: 6000,
    ACTION_ROUTE: '/hw_drivers/action',

    RPC_DELAY: 1500,
    MAX_RPC_DELAY: 1500 * 10,
    
    _retries: 0,

    /**
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);
        this._session_id = this._createUUID();
        this._listeners = {};
        this._delayedStartPolling(this.RPC_DELAY);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------
    /**
     * Add a device_id to listeners[iot_ip] and restart polling
     *
     * @param {String} iot_ip
     * @param {Array} devices list of devices
     * @param {Callback} callback
     */
    addListener: function (iot_ip, devices, callback) {
        if (!this._listeners[iot_ip]) {
            this._listeners[iot_ip] = {
            devices: {},
            session_id: this._session_id,
            rpc: false,
            };
        }
        for (var device in devices) {
            this._listeners[iot_ip].devices[devices[device]] = {
                device_id: devices[device],
                callback: callback,
            };
        }
        this.stopPolling(iot_ip);
        this.startPolling(iot_ip);
        return Promise.resolve();
    },
    /**
     * Stop listening to iot device with id `device_id`
     * @param {string} iot_ip 
     * @param {string} device_id 
     */
    removeListener: function(iot_ip, device_id) {
        delete this._listeners[iot_ip].devices[device_id];
    },
    /**
     * Execute a action on device_id
     * Action depend of driver that support the device
     *
     * @param {String} iot_ip
     * @param {String} device_id
     * @param {Object} data contains the information needed to perform an action on this device_id
     */
    action: function (iot_ip, device_id, data) {
        this.parseURL = new URL(window.location.href);
        var self = this;
        var data = {
            params: {
                session_id: self._session_id,
                device_id: device_id,
                data: JSON.stringify(data),
            }
        };
        var options = {
            timeout: this.ACTION_TIMEOUT,
        };
        var prom = new Promise(function(resolve, reject) {
            self._rpcIoT(iot_ip, self.ACTION_ROUTE, data, options)
                .then(resolve)
                .fail(reject);
        });
        return prom;
    },

    /**
     * Start a long polling, i.e. it continually opens a long poll
     * connection as long as it is not stopped (@see `stopPolling`)
     */
    startPolling: function (iot_ip) {
        if (iot_ip) {
            if (!this._listeners[iot_ip].rpc) {
                this._poll(iot_ip);
            }
        } else {
            var self = this;
            _.each(this._listeners, function (listener, ip) {
                self.startPolling(ip);
            });
        }
    },
    /**
     * Stops any started long polling
     *
     * Aborts a pending longpoll so that we immediately remove ourselves
     * from listening on notifications on this channel.
     */
    stopPolling: function (iot_ip) {
        if (this._listeners[iot_ip].rpc) {
            this._listeners[iot_ip].rpc.abort();
            this._listeners[iot_ip].rpc = false;
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------
    _delayedStartPolling: function (delay){
        var self = this;
        setTimeout(function (){
            self.startPolling();
        }, delay);
    },

    _createUUID: function () {
        var s = [];
        var hexDigits = "0123456789abcdef";
        for (var i = 0; i < 36; i++) {
            s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
        }
        s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
        s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
        s[8] = s[13] = s[18] = s[23] = "-";
        return s.join("");
    },
    /**
     * Execute a RPC to the box
     * Used to do polling or an action
     *
     * @param {String} iot_ip
     * @param {String} route
     * @param {Object} data information needed to perform an action or the listener for the polling
     * @param {Object} options.timeout
     */
    _rpcIoT: function (iot_ip, route, data, options) {
        this.parseURL = new URL(window.location.href);
        var port = this.parseURL.protocol === 'http:' ? ':8069' : '';
        var url = this.parseURL.protocol + '//' + iot_ip + port;
        var queryOptions = _.extend({
            url: url + route,
            dataType: 'json',
            contentType: "application/json;charset=utf-8",
            data: JSON.stringify(data),
            method: 'POST',
        }, options);
        var request = $.ajax(queryOptions);
        if (this._listeners[iot_ip] && route === '/hw_drivers/event') {
            this._listeners[iot_ip].rpc = request;
            return this._listeners[iot_ip].rpc;
        } else {
            return request;
        }
    },
    /**
     * Make a request to an IoT Box
     *
     * @param {String} iot_ip
     */
    _poll: function (iot_ip) {
        var self = this;
        var listener = this._listeners[iot_ip];
        var data = {
            params: {
                listener: listener,
            }
        };
        var options = {
            timeout: this.POLL_TIMEOUT,
        };

        // The backend has a maximum cycle time of 50 seconds so give +10 seconds
        this._rpcIoT(iot_ip, this.POLL_ROUTE, data, options)
            .then(function (result) {
                self._listeners[iot_ip].rpc = false;
                if (result.result) {
                    if (self._session_id === result.result.session_id) {
                        self._onSuccess(iot_ip, result.result);
                    }
                } else {
                    self._onError();
                }
            }).fail(function (jqXHR, textStatus) {
                if (textStatus === 'error' && self.parseURL.protocol === 'https:') {
                    self._doWarnCertificate(iot_ip);
                } else {
                    self._onError();
                }
            });
    },

    _onSuccess: function (iot_ip, result){
        var self = this;
        var devices = this._listeners[iot_ip].devices;
        if (devices[result.device_id]) {
            devices[result.device_id].callback(result);
        }
        self._poll(iot_ip);
        self._retries = 0;
    },

    _onError: function (){
        this._retries++;
        this._delayedStartPolling(Math.min(this.RPC_DELAY * this._retries, this.MAX_RPC_DELAY));
    },

    _doWarnCertificate: function (url){
        var $content = $('<div/>')
            .append($('<p/>').html(_.str.sprintf('<a href="https://%s" target="_blank"><i class="fa fa-external-link"/>' + _t('Click here to open your IoT Homepage') + '</a>', url)))
            .append($('<li/>').text(_t('Please accept the certificate of your IoT Box (procedure depends on your browser) :')))
            .append($('<li/>').text(_t('Click on Advanced/Show Details/Details/More information')))
            .append($('<li/>').text(_t('Click on Proceed to .../Add Exception/Visit this website/Go on to the webpage')))
            .append($('<li/>').text(_t('Firefox only : Click on Confirm Security Exception')))
            .append($('<li/>').text(_t('Close this window and try again')));

        var dialog = new Dialog(this, {
            title: _t('Connection to device failed'),
            $content: $content,
            buttons: [
                {
                    text: _t('Close'),
                    classes: 'btn-secondary o_form_button_cancel',
                    close: true,
                }
            ],
        });

        dialog.open();
    },
});

core.serviceRegistry.add('iot_longpolling', IoTLongpolling);

var IotValueFieldMixin = {

    /**
     * @returns {Promise}
     */
    willStart: function() {
        this.iot_device = null; // the attribute to which the device proxy created with ``_getDeviceInfo`` will be assigned.
        return Promise.all([this._super(), this._getDeviceInfo()]);
    },

    start: function() {
        this._super.apply(this, arguments);
        if (this.iot_device) {
            this.iot_device.add_listener(this._onValueChange.bind(this));
        }
    },

    /**
     * To implement
     * @abstract
     * @private
     */
    _getDeviceInfo: function() {},

    /**
     * To implement
     * @abstract
     * @private
     */
    _onValueChange: function (data){},
};

var IotRealTimeValue = basic_fields.InputField.extend(IotValueFieldMixin, {

    /**
     * @private
     */
    _getDeviceInfo: function() {
        this.test_type = this.record.data.test_type;
        if (this.test_type === 'measure') {
            this.iot_device = new DeviceProxy({ iot_ip: this.record.data.ip, identifier: this.record.data.identifier });            
        }
        return Promise.resolve();
    },

    /**
     * @private
     */
    _onValueChange: function (data){
        var self = this;
        this._setValue(data.value.toString())
            .then(function() {
                if (!self.isDestroyed()) {
                    self._render();
                }
            });
    },

});

var IotDeviceValueDisplay = Widget.extend(IotValueFieldMixin, {

    init: function (parent, params) {
        this._super.apply(this, arguments);
        this.identifier = params.data.identifier;
        this.iot_ip = params.data.iot_ip;
    },
    /**
     * @override
     * @private
     */
    _getDeviceInfo: function() {
        var self = this;
        self.iot_device = new DeviceProxy({ identifier: this.identifier, iot_ip:this.iot_ip });
        return Promise.resolve();
    },

    /**
     * @override
     * @private
     */
    _onValueChange: function (data){
        if (this.$el) {
            this.$el.text(data.value);
        }
    },

});


field_registry.add('iot_realtime_value', IotRealTimeValue);
widget_registry.add('iot_device_value_display', IotDeviceValueDisplay);

var _iot_longpolling = new IoTLongpolling();

/**
 * Frontend interface to iot devices
 */
var DeviceProxy = core.Class.extend({
    /**
     * @param {Object} iot_device - Representation of an iot device
     * @param {string} iot_device.iot_ip - The ip address of the iot box the device is connected to
     * @param {string} iot_device.identifier - The device's unique identifier
     */
    init: function(iot_device) {
        this._iot_longpolling = _iot_longpolling;
        this._iot_ip = iot_device.iot_ip;
        this._identifier = iot_device.identifier;
    },

    /**
     * Call actions on the device
     * @param {Object} data
     * @returns {Promise}
     */
    action: function(data) {
        return this._iot_longpolling.action(this._iot_ip, this._identifier, data);
    },

    /**
     * Add `callback` to the listeners callbacks list it gets called everytime the device's value is updated.
     * @param {function} callback
     * @returns {Promise}
     */
    add_listener: function(callback) {
        return this._iot_longpolling.addListener(this._iot_ip, [this._identifier, ], callback);
    },
    /**
     * Stop listening the device
     */
    remove_listener: function() {
        return this._iot_longpolling.removeListener(this._iot_ip, this._identifier);
    },
});

return {
    IotValueFieldMixin: IotValueFieldMixin,
    IotRealTimeValue: IotRealTimeValue,
    IotDeviceValueDisplay: IotDeviceValueDisplay,
    IoTLongpolling: IoTLongpolling,
    DeviceProxy: DeviceProxy
};
});
