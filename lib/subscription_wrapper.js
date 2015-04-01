'use strict';
var _ = require('lodash');

function SubscriptionWrapper(subscription) {
  _.forOwn(subscription.toObject(), _.bind(function (n, key) {
    this[key] = n;
  }, this));
  this._subscription = subscription;
}

SubscriptionWrapper.prototype.get = function (key) {
  /* istanbul ignore if */
  if (!this._subscription.meta) {
    return null;
  }
  return this._subscription.meta[key];
};

SubscriptionWrapper.prototype.set = function (key, value) {
  this._subscription.meta = this._subscription.meta || /* istanbul ignore next */ {};
  this._subscription.meta[key] = value;
  this._subscription.markModified('meta');
};

SubscriptionWrapper.prototype.save = function () {
  return this._subscription.saveAsync();
};

module.exports = SubscriptionWrapper;
