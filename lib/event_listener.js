'use strict';
var EventBroker = require('broker');
var eventBroker = new EventBroker();
var _ = require('lodash');

function eventListener(subscription, connector, bucket) {
  this.subscription = subscription;
  this.connector = connector;
  this.bucket = bucket;
  this.slug = this.connector.connectorType.replace(/hoist-connector-/, '').toLowerCase();
}

eventListener.prototype.listen = function () {
  _.forEach(this.subscription.endpoints, _.bind(this.createListeners, this));
};

eventListener.prototype.createListeners = function (endpoint) {
  var singularEndpointName = endpoint.replace(/\//, '').replace(/s$/, '').toLowerCase();
  var newEvent = this.slug + ':new:' + singularEndpointName;
  var modifiedEvent = this.slug + ':modified:' + singularEndpointName;
  var emitter = this.subscription.eventEmitter;
  var options = {
    applicationId: this.subscription.application,
    environment: this.subscription.environment,
    bucketId: this.bucket._id
  };

  emitter.on(newEvent, function (payload) {
    options.eventName = newEvent;
    options.payload = payload;
    var ev = new EventBroker.events.ApplicationEvent(options);
    return eventBroker.send(ev).then(function () {
      return ev;
    });
  });
  emitter.on(modifiedEvent, function (payload) {
    options.eventName = modifiedEvent;
    options.payload = payload;
    var ev = new EventBroker.events.ApplicationEvent(options);
    return eventBroker.send(ev).then(function () {
      return ev;
    });
  });
};

module.exports = function (subscription, connector, bucket) {
  var listener = new eventListener(subscription, connector, bucket);
  listener.listen();
};