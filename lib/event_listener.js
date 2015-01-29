'use strict';
var EventBroker = require('broker');
var eventBroker = new EventBroker();
var _ = require('lodash');
var Model = require('hoist-model');
EventBroker.ModelResolver.set(Model);

function EventListener(subscription, connector, bucket) {
  this.subscription = subscription;
  this.connector = connector;
  this.bucket = bucket;
}

EventListener.prototype.listen = function () {
  _.forEach(this.subscription.endpoints, _.bind(this.createListeners, this));
};

EventListener.prototype.createListeners = function (endpoint) {
  var singularEndpointName = endpoint.replace(/\//, '').replace(/s$/, '').toLowerCase();
  var newEvent = this.connector.key + ':new:' + singularEndpointName;
  var modifiedEvent = this.connector.key + ':modified:' + singularEndpointName;
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
    }).catch(function (err) {
      console.log('err', err);
    });
  });
};
module.exports = EventListener;