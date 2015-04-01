'use strict';

function SubscriptionWrapper(subscription) {
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
