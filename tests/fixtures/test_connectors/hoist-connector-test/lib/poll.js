'use strict';
var BBPromise = require('bluebird');

module.exports = function (app, subscription, connector, bouncer) {
  var eventName = connector.key + ':modified:invoice';
  subscription.eventEmitter.emit(eventName, {key: 'value'});
  return subscription.eventEmitter.emit('done');
}