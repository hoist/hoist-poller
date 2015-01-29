'use strict';
var BBPromise = require('bluebird');

module.exports = function (app, bucket, subscription, bouncer, connector) {
  var eventName = connector.key + ':modified:invoice';
  return subscription.eventEmitter.emit(eventName, {key: 'value'})
}