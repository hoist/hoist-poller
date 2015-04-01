'use strict';
var _ = require('lodash');

function SubscriptionWrapper(subscription) {
  _.forOwn(subscription.toObject(), _.bind(function (n, key) {
    this[key] = n;
  }, this));
  this._subscription = subscription;
}

SubscriptionWrapper.prototype.get = function (key) {
  return this._subscription.meta[key];
};

SubscriptionWrapper.prototype.set = function (key, value) {
  this._subscription.meta[key] = value;
};

SubscriptionWrapper.prototype.save = function () {
  return this._subscription.saveAsync();
};

module.exports = SubscriptionWrapper;
