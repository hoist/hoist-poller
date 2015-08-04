'use strict';
import {
  forOwn
}
from 'lodash';

class SubscriptionWrapper {
  constructor(subscription) {
    forOwn(subscription.toObject(), (n, key) => {
      this[key] = n;
    });
    this._subscription = subscription;
  }

  get(key) {
    /* istanbul ignore if */
    if (!this._subscription.meta) {
      return null;
    }
    return this._subscription.meta[key];
  }
  delayTill(dateTime) {
    this._subscription.nextPoll = dateTime;
  }
  set(key, value) {
    this._subscription.meta = this._subscription.meta || /* istanbul ignore next */ {};
    this._subscription.meta[key] = value;
    this._subscription.markModified('meta');
  }
  save() {
    return this._subscription.saveAsync();
  }
}

export default SubscriptionWrapper;
